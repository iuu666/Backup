/*
 🔴🔴🔴🔴写在开头🔴🔴🔴🔴
🟢🟢🟢🟢脚本原作者🎉🎉🎉 大圣 🎉🎉🎉🟢🟢🟢🟢
🟡🟡🟡🟡  https://github.com/MCdasheng/QuantumultX/tree/main/Scripts/myScripts  🟡🟡🟡🟡
👆👇👆👇👆👇👆👇👆👇👆👇👆👇👆👇👆👇👆👇👆👇👆👇👆👇👆👇
🔵🔵🔵🔵 General℡ 更改🔵🔵🔵🔵
 🟡🟡🟡🟡  https://github.com/General74110/Scripts/Script/Task  🟡🟡🟡🟡
🎵酷我音乐 v1.6.1
🥳脚本功能:
  ✅昵称查询
  ✅每日小说
  ✅每日签到
  ✅每日听歌
  ✅每日收藏
  ✅创意视频
  ✅免费抽奖
  ✅视频抽奖
  ✅惊喜任务
  ✅定时宝箱
  ✅补领宝箱
  ✅资产查询
  ✅兑换会员
  ✅整点打卡
  ✅累计奖励
  ✅活动宝箱
  ✅到期时间

🎯重写脚本:
 在网页酷我音乐上登陆，手机端需切换到桌面版才有登录口，登陆成功后切回移动版，成功获取Cookies！
  [Script]
http-request ^https:\/\/.*\/(newh5app\/singers\/0\?|openapi\/v1\/www\/search\/searchKey\?) script-path=https://raw.githubusercontent.com/General74110/Scripts/master/Script/Task/kuwo_Cookies.js, requires-body=true, timeout=60, enabled=false, tag=酷我音乐(积分)获取Cookies, images-url=https://raw.githubusercontent.com/deezertidal/private/main/icons/kuwosvip.png
[MITM]
hostname = *.kuwo.cn
⏰定时任务:
  cron "*每12分钟运行一次" script-path=https://raw.githubusercontent.com/iuu666/Backup/refs/heads/main/js/KuWoMusic/Task/other.1/kuwo.js,
   timeout=3000, tag=酷我音乐(积分), images-url=https://raw.githubusercontent.com/deezertidal/private/main/icons/kuwosvip.png
🔍手动抓包: 
  开启抓包,进入网页登陆后的界面
  搜索url记录关键词"configuration\/signature"请求头中的Cookies里的 userid和 websid 分别填入BoxJs（userid=loginUid，websid=loginSid）

 
📦BoxJs地址:
 https://raw.githubusercontent.com/General74110/Scripts/master/boxjs/General.json(General℡版)改变了获取Cookies的途径，添加了多账号，增加多次运行防遗漏，更改为每15万积分兑换30天的会员

 ## 👍https://raw.githubusercontent.com/MCdasheng/QuantumultX/main/mcdasheng.boxjs.json（原作者大圣版）


*/

const $ = new Env('酷我音乐');
// 通知和日志设置
let tz = $.getval('tz') || '1'; // 通知设置：0关闭通知，1开启通知
const logs = 0; // 日志设置：0关闭日志，1开启日志
const notify = $.isNode() ? require('./sendNotify') : '';
let notifyMsg = []; // 声明 notifyMsg 数组，用于存储任务信息
const Clear = $.getval("Clear") || 0;
// 检查是否在 Node.js 环境中
const isNode = typeof process !== "undefined" && process.env;

if (isNode) {
    // Node.js 环境下加载 .env 文件中的环境变量
    const dotenv = require('dotenv');
    dotenv.config();
}

// 获取环境变量ID，适配不同环境
let accounts = $.getdata('Kuwo_cookies') || ($.isNode() ? process.env.KUWO_COOKIE : ''); // 在不同环境下处理
if (logs) console.log(`读取到的 ID: ${accounts}`);

// 解析ID为账号数组
let accountArr = accounts.split(/[&]/).map(a => a.trim()); // 将多个账号信息用 & 隔开并拆分为数组
let kuwoNameArr = [];

// 验证环境变量格式
if (accountArr.length === 0 || !accounts || !accounts.includes('@')) {
    $.msg($.name, '', '⚠️ 未检测到有效Cookie 请先获取！');
    $.done();

}

const kw_headers = {
    'Origin' : `https://h5app.kuwo.cn`,
    'Accept-Encoding' : `gzip, deflate, br`,
    'Connection' : `keep-alive`,
    'Sec-Fetch-Mode' : `cors`,
    'Accept' : `application/json, text/plain, */*`,
    'Host' : `integralapi.kuwo.cn`,
    'User-Agent' : `Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KWMusic/11.2.3.0 DeviceModel/iPhone15,3 NetType/WIFI kuwopage`,
    'Sec-Fetch-Site' : `same-site`,
    'Referer' : `https://h5app.kuwo.cn/`,
    'Sec-Fetch-Dest' : `empty`,
    'Accept-Language' : `zh-CN,zh-Hans;q=0.9`
};

!(async () => {
    $.log(`检测到 ${accountArr.length} 个有效账户`);

    for (let i = 0; i < accountArr.length; i++) {
        const ID = accountArr[i];

        // 验证账户格式
        if (!ID.includes('@')) {
            $.log(`账户信息格式错误：${ID}，跳过此账户`);
            continue;
        }
        if (Clear == 1) {
            await clearEnvVars()
            $.msg('所有Cookie已清除！！！')

            $.done(); // 终止脚本
        }



        const nickname = await getNickname(ID);
        const displayName = nickname || `用户${i + 1}`;
        notifyMsg = [`【এ${displayName}এ】`]; // 清空并初始化每个账号的通知内容
        //await getAsset(ID, displayName);

        if (nickname == null) {
            const title = "酷我音乐(积分)";
            const content = "⚠️ Cookie 已失效，请更新";

            if ($.isNode()) {
                await notify.sendNotify(title, content); // Node.js 环境下使用 sendNotify
            } else if ($.isLoon() || $.isQuanX() || $.isSurge())
            {
                $.msg(title, "", content); // 其他环境下使用 $.msg
            } else {
                console.log(title, content)
            }

            $.done(); // 终止脚本
            return;
        }

        await executeTasks(ID, displayName);

        // 每个账号完成任务后立即发送通知
        const message = notifyMsg.join("\n"); // 将通知内容合并为一个字符串
        if ($.isNode()) {
            await notify.sendNotify(`${$.name}`, message);
        } else {
            $.msg(`${$.name}`, '', message);
        }
    }
})().catch((e) => $.logErr(e))
    .finally(() => $.done());

// 执行任务逻辑
async function executeTasks(ID, displayName) {
    $.log(`\n开始执行任务 - 账户：${displayName}`);



    //查询积分
    await getAsset(ID, displayName);
    await VipExtime(ID, displayName);
    //兑换会员
    const Property = $.asset.data.remainScore

    if (Property >= 150000) {
        await Convert (ID); // 每15万积分兑换会员
    }


    const now = new Date();
    const currentDate = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

// 只在 7:00 - 20:00 的整点运行
    if (currentHour >= 7 && currentHour <= 20 && currentMinute === 0) {
        console.log(`🟢 当前时间 ${currentHour}:00，符合条件，执行 Clockin 任务`);
        await Clockin(ID);//整点打卡
        await box(ID);  //定时宝箱 ’不再传递 `time` 参数‘
    }
        await BoxTask(ID);// 新宝箱金币，每十分钟开宝箱
    //以下只在6.30-7.30和19.30-20.30运行
    const currentTotalMinutes = currentHour * 60 + currentMinute;

// 时间段（总分钟数）
    const morningStart = 6 * 60 + 30;  // 6:30
    const morningEnd   = 7 * 60 + 30;  // 7:30
    const eveningStart = 19 * 60 + 30; // 19:30
    const eveningEnd   = 20 * 60 + 30; // 20:30

// 初始化当天执行状态（可以存储到 $.setval 持久化）
    let executedTasks = JSON.parse($.getval('executedTasks') || '{}');
    const today = currentDate.toISOString().slice(0, 10); // YYYY-MM-DD
    if (!executedTasks[today]) executedTasks[today] = { morning: [], evening: [] };

// 判断当前时间属于哪个时间段
    let timeSlot = null;
    if (currentTotalMinutes >= morningStart && currentTotalMinutes <= morningEnd) {
        timeSlot = 'morning';
    } else if (currentTotalMinutes >= eveningStart && currentTotalMinutes <= eveningEnd) {
        timeSlot = 'evening';
    }

    if (timeSlot) {
        console.log(`🟢 当前时间 ${currentHour}:${currentMinute}，属于 ${timeSlot} 时段`);

       // if (logs === 1) {
          //  $.setval('{}', 'executedTasks');
          //  console.log('✅ 已清空所有账号的执行状态标记');
      //  }

        // 如果当前账号当天该时段已经执行过，就跳过
            if (!executedTasks[today][timeSlot].includes(ID)) {

            // 执行任务
            await novel(ID);
            await mobile(ID);
            await Listen(ID);
            await Earning(ID);
            await collect(ID);
            await loterry_free(ID);
            await new_sign(ID);
            await sign(ID);

            for (let i = 0; i < 20; i++) await video(ID);
            for (let k = 0; k < 8; k++) await loterry_video(ID);

            // 标记该账号该时段已执行
            executedTasks[today][timeSlot].push(ID);

            // 保存执行状态
           $.setval(JSON.stringify(executedTasks), 'executedTasks');
        }
    }

    for (let j = 0; j < 1; j++) {
        await $.wait(1000); // 延迟1秒再调用
        await surprise(ID);//惊喜任务
    }

}

// 清除环境变量
async function clearEnvVars() {
    $.setdata('', 'Kuwo_cookies');
}

// 获取昵称
async function getNickname(ID) {
    let [loginUid] = ID.split('@');
    return new Promise((resolve) => {
        let url = {
            url : `https://integralapi.kuwo.cn/api/v1/online/sign/v1/music/userBase?loginUid=${loginUid}`,
            headers: kw_headers,
        };

        $.get(url, (err, resp, data) => {
            if (logs == 1) {
                console.log('查询昵称任务调试响应体：',data);
            }
            try {
                if (err) {
                    $.logErr(`获取昵称失败：${err}`);
                    resolve('');
                    return;
                }

                data = JSON.parse(data);
                const nickname = data.data.nickname;
                resolve(nickname);
            } catch (e) {
                $.logErr(e);
                resolve('');
            }
        });
    });
}


// 获取会员到期时间
async function VipExtime(ID) {
    const [loginUid, loginSid] = ID.split('@');

    let options = {
        url: `http://vip1.kuwo.cn/vip/v2/user/vip?op=ui&uid=${loginUid}&sid=${loginSid}&signver=new`,
        headers: {
            "Host": "vip1.kuwo.cn",
            "Range": "bytes=0-",
            "Accept": "*/*",
            "User-Agent": "%E9%85%B7%E6%88%91%E9%9F%B3%E4%B9%90/3830 CFNetwork/1498.700.2.1.1 Darwin/23.6.0",
            "Accept-Language": "zh-CN,zh-Hans;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
        },
    };

    return $.http.get(options).then((resp) => {
        if (logs == 1) console.log('查询会员到期时间响应体：', resp.body);
        let desc = '';
        try {
            const obj = JSON.parse(resp.body || resp);
            if (obj.meta?.code !== 200) {
                desc = `⚠️ 查询失败，接口返回code=${obj.meta?.code}`;
                $.log(desc);
                notifyMsg.push(desc);
                return desc;
            }

            const vipData = obj.data || {};
            let expireTimestamp = Number(vipData.vipLuxuryExpire || vipData.vipmExpire || vipData.vipExpire || 0);

            if (!expireTimestamp || expireTimestamp === 0) {
                desc = '🔴 未开通会员';
                $.log(desc);
                notifyMsg.push(desc);
                return desc;
            }

            // 自动处理秒/毫秒时间戳
            if (expireTimestamp < 1e12) expireTimestamp *= 1000;

            // 转换为年月日时分秒
            const expireDate = new Date(expireTimestamp);
            desc = `🎟️ 会员到期时间：${expireDate.getFullYear()}-${String(expireDate.getMonth() + 1).padStart(2, '0')}-${String(expireDate.getDate()).padStart(2, '0')} ${String(expireDate.getHours()).padStart(2, '0')}:${String(expireDate.getMinutes()).padStart(2, '0')}:${String(expireDate.getSeconds()).padStart(2, '0')}`;

            $.log(desc);
            notifyMsg.push(desc);
            return desc;
        } catch (e) {
            $.logErr(e);
            desc = '❌ 查询会员到期时间失败';
            notifyMsg.push(desc);
            return desc;
        }
    });
}




async function getAsset(ID) {
    const [loginUid, loginSid] = ID.split('@');
    let options = {
        url: `https://integralapi.kuwo.cn/api/v1/online/sign/v1/earningSignIn/earningUserSignList?loginUid=${loginUid}&loginSid=${loginSid}`,
        headers: kw_headers,
    };

    return $.http.get(options).then((resp) => {
        $.log("🟡正在查询资产...");
        if (logs == 1) {
            console.log('查询资产任务调试响应体：',resp.body);
        }
        var score;
        var obj = JSON.parse(resp.body);

        if (obj.code == 200 && obj.msg == "success" && obj.success == true) {
            score = obj.data.remainScore ? obj.data.remainScore : 0;
            if (score != 0) {
                var money = (score / 10000).toFixed(2);
                desc = `💰${score} --> 💴${money} CNY`;
            } else desc = `🔴资产查询失败!`;
        } else {
            desc = `❌资产查询: 错误!`;
            $.log(resp.body);
        }
        $.asset = obj;
        $.log(desc);
        notifyMsg.push(desc);
        return desc;
    });
}

async function novel(ID) {
    const [loginUid, loginSid] = ID.split('@');

    let options = {
        url: `https://integralapi.kuwo.cn/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${loginUid}&loginSid=${loginSid}&from=novel&goldNum=18`,
        headers: kw_headers,
    };

    return $.http.get(options).then((resp) => {
        $.log("🟡正在执行每日小说任务...");
        if (logs === 1) {
            console.log('每日小说任务调试响应体：',resp.body);
        }
        var desc;
        try {
            var obj = JSON.parse(resp.body);
            if (obj.code === 200 && obj.msg === "success" && obj.success === true) {
                desc = obj.data.description;
                if (desc === "成功") desc = `🎉每日小说: ${desc}`;
                else if (desc === "今天已完成任务") desc = `🟢每日小说: ${desc}`;
                else if (desc === "用户未登录") desc = `🔴每日小说: ${desc}`;
                else desc = `⚠️每日小说: ${desc}`;
            } else {
                desc = `❌每日小说: 错误!`;
                $.log(resp.body);
            }
        } catch (e) {
            desc = `❌每日小说: 响应解析失败!`;
            $.logErr(e);
        }

        $.log(desc);
        notifyMsg.push(desc);
    });
}

async function mobile(ID) {
    const [loginUid, loginSid] = ID.split('@');
    let options = {
        url: `https://integralapi.kuwo.cn/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${loginUid}&loginSid=${loginSid}&from=mobile&goldNum=18`,
        headers: kw_headers,
    };

    return $.http.get(options).then((resp) => {
        $.log("🟡正在执行每日听歌任务...");
        if (logs === 1) {
            console.log('每日听歌任务调试响应体：',resp.body);
        }
        var desc;
        var obj = JSON.parse(resp.body);
        if (obj.code === 200 && obj.msg === "success" && obj.success === true) {
            desc = obj.data.description;
            if (desc === "成功") desc = `🎉每日听歌: ${desc}`;
            else if (desc === "今天已完成任务") desc = `🟢每日听歌: ${desc}`;
            else if (desc === "用户未登录") desc = `🔴每日听歌: ${desc}`;
            else desc = `⚠️每日听歌: ${desc}`;
        } else {
            desc = `❌每日听歌: 错误!`;
            $.log(resp.body);
        }
        $.log(desc);
        notifyMsg.push(desc);
    });
}


// 📌 查询每日听歌任务状态，返回可领取的时间（包含秒 & 分钟）
async function cxListen(ID) {
    const [loginUid, loginSid] = ID.split('@');
    let options = {
        url: `https://integralapi.kuwo.cn/api/v1/online/sign/v1/earningSignIn/newUserSignList?loginUid=${loginUid}&loginSid=${loginSid}`,
        headers: kw_headers,
    };

    return $.http.get(options).then((resp) => {
        $.log("🟡 正在查询每日听歌接口...");
        if (logs === 1) {
            console.log('📑 每日听歌接口查询任务响应体：', resp.body);
        }

        let obj = JSON.parse(resp.body);
        if (obj.code === 200 && obj.success) {
            let listenTasks = obj.data.dataList.find(task => task.taskType === "listen");

            if (!listenTasks || !listenTasks.listenList) {
                $.log(`🔴 未找到听歌任务数据`);
                return { golds: [] };
            }

            // **存储 接口任务**，只获取那些金豆数量有效的任务
            let golds = listenTasks.listenList
                .filter(task => task.timetraStatus != "0" && task.goldNum != "null")
                .map(task => ({
                    goldNum: task.goldNum,
                    time: task.time, // 任务时间
                    unit: task.unit // 任务单位（秒/分钟）
                }));

            console.log(`可领取的接口任务: ${golds.map(task => task.goldNum).join(', ')} 积分`);

            return { golds };
        } else {
            $.log(`🔴 查询失败：${obj.msg}`);
            return { golds: [] };
        }
    }).catch((err) => {
        $.logErr(`🔴 查询每日听歌时间失败: ${err}`);
        return { golds: [] };
    });
}

// 🎵 领取听歌积分（根据goldNum对应的任务时间）
async function Listen(ID) {
    const [loginUid, loginSid] = ID.split('@');
    let { golds } = await cxListen(ID); // 查询可领取的任务

    if (golds.length === 0) {
        $.log(`🟠 没有可领取的听歌时间，任务终止`);
        return;
    }

    $.log("🟡 开始按顺序执行听歌任务...");

    // 依次执行每个任务，按照查询返回的golds数组
    for (let task of golds) {
        const { goldNum, time, unit } = task;
        if (goldNum && time && unit) {
            const unitStr = unit === "s" ? "秒" : unit === "m" ? "分钟" : unit; // 转换单位用于日志
            await performListenTask(loginUid, loginSid, time, goldNum, unit, unitStr);
        } else {
            $.log(`🔴 未知任务: ${goldNum}，跳过`);
        }
    }
}

// 📌 执行听歌任务
async function performListenTask(loginUid, loginSid, listenTime, listenGold, unitType, unitStr) {
    $.log(`🟡 正在执行 ${listenTime} ${unitStr} 进行听歌任务`);  // 使用unitStr显示中文单位
    $.log(`🟡 正在使用 ${listenGold} 积分进行任务`);

    let options = {
        url: `https://integralapi.kuwo.cn/api/v1/online/sign/v1/earningSignIn/newDoListen?loginUid=${loginUid}&loginSid=${loginSid}&from=listen&goldNum=${listenGold}&listenTime=${listenTime}&unit=${unitType}`,  // URL中继续用s和m
        headers: kw_headers,
    };

    await $.http.get(options).then((resp) => {
        if (logs === 1) {
            console.log(`📑 每日听歌任务响应体：`, resp.body);
        }

        let obj = JSON.parse(resp.body);
        let desc = '';

        if (obj.code === 200 && obj.success === true) {
            desc = obj.data.description;
            if (obj.data.status === 1)
                desc = `🎉 每日听歌成功: ${desc}（使用 ${listenTime} ${unitStr}）`;
            else if (desc === "今天已完成任务")
                desc = `🟢 每日听歌: ${obj.data.description}（使用 ${listenTime} ${unitStr}）`;
            else if (obj.msg === "用户未登录")
                desc = `🔴 每日听歌: ${obj.data.description}（使用 ${listenTime} ${unitStr}）`;
        }
         else {
            desc = `⚠️ 每日听歌: ${obj.data.description}（使用 ${listenTime} ${unitStr}）`;
        }

        $.log(desc);
        notifyMsg.push(desc);

    }).catch((err) => {
        $.logErr(`❌ 尝试 ${listenTime} ${unitStr} 时出错: ${err}`);
    });
}


async function collect(ID) {
    const [loginUid, loginSid] = ID.split('@');
    let options = {
        url: `https://integralapi.kuwo.cn/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${loginUid}&loginSid=${loginSid}&from=collect&goldNum=18`,
        headers: kw_headers,
    };

    return $.http.get(options).then((resp) => {
        $.log("🟡正在执行每日收藏任务...");
        if (logs === 1) {
            console.log('每日收藏任务调试响应体：',resp.body);
        }
        var desc;
        var obj = JSON.parse(resp.body);
        if (obj.code === 200 && obj.msg === "success" && obj.success === true) {
            desc = obj.data.description;
            if (desc === "成功") desc = `🎉每日收藏: ${desc}`;
            else if (desc === "今天已完成任务") desc = `🟢每日收藏: ${desc}`;
            else if (desc === "用户未登录") desc = `🔴每日收藏: ${desc}`;
            else desc = `⚠️每日收藏: ${desc}`;
        } else {
            desc = `❌每日收藏: 错误!`;
            $.log(resp.body);
        }
        $.log(desc);
        notifyMsg.push(desc);
    });
}

async function video(ID) {
    const [loginUid, loginSid] = ID.split('@');
    let options = {
        url: `https://integralapi.kuwo.cn/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${loginUid}&loginSid=${loginSid}&from=videoadver&goldNum=58`,
        headers: kw_headers,
    };

    return $.http.get(options).then((resp) => {
        $.log("🟡正在执行创意视频任务...");
        if (logs === 1) {
            console.log('创意视频任务调试响应体：',resp.body);
        }
        var desc;
        var obj = JSON.parse(resp.body);
        if (obj.code === 200 && obj.msg === "success" && obj.success === true) {
            desc = obj.data.description;
            if (desc === "成功") desc = `🎉创意视频: ${desc}`;
            else if (desc === "今天已完成任务") desc = `🟢创意视频: ${desc}`;
            else if (desc === "用户未登录") desc = `🔴创意视频: ${desc}`;
            else desc = `⚠️创意视频: ${desc}`;
        } else {
            desc = `❌创意视频: 错误!`;
            $.log(resp.body);
        }
        $.log(desc);
        notifyMsg.push(desc);
    });
}

async function sign(ID) {
    const [loginUid, loginSid] = ID.split('@');
    let options = {
        url: `https://integralapi.kuwo.cn/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${loginUid}&loginSid=${loginSid}&from=sign&extraGoldNum=110`,
        headers: kw_headers,
    };

    return $.http.get(options).then((resp) => {
        $.log("🟡正在执行每日签到任务...");
        if (logs === 1) {
            console.log('每日签到任务调试响应体：',resp.body);
        }
        var desc;
        var obj = JSON.parse(resp.body);
        if (obj.code === 200 && obj.msg === "success" && obj.success === true) {
            desc = obj.data.description;
            if (desc === "成功") desc = `🎉每日签到: ${desc}`;
            else if (desc === "今天已完成任务") desc = `🟢每日签到: ${desc}`;
            else if (desc === "用户未登录") desc = `🔴每日签到: ${desc}`;
            else if (desc === "已达到当日观看额外视频次数") desc = `🟢每日签到: ${desc}`;
            else desc = `⚠️每日签到: ${desc}`;
        } else {
            desc = `❌每日签到: 错误!`;
            $.log(resp.body);
        }
        $.log(desc);
        notifyMsg.push(desc);
    });
}

async function new_sign(ID) {
    const [loginUid, loginSid] = ID.split('@');
    let options = {
        url: `https://integralapi.kuwo.cn/api/v1/online/sign/v1/earningSignIn/newUserSignList?loginUid=${loginUid}&loginSid=${loginSid}`,
        headers: kw_headers,
    };
    return $.http.get(options).then((resp) => {
        $.log("🟡正在执行每日签到任务...");
        if (logs === 1) {
            console.log('每日签到new任务调试响应体：',resp.body);
        }
        var desc;
        var obj = JSON.parse(resp.body);
        if (obj.code === 200 && obj.msg === "success" && obj.success === true) {
            desc = obj.data.isSign;
            if (desc === true) desc = `🟢每日签到: 成功!`;
            else if (desc === "用户未登录") desc = `🔴每日签到: 失败`;
        } else {
            desc = `❌每日签到: 错误!`;
            $.log(resp.body);
        }
        $.log(desc);
        notifyMsg.push(desc);
    });
}


//今日累计奖励强领50/100/3000金币
async function Earning(ID) {
    return new Promise(async (resolve) => {
        const [loginUid, loginSid] = ID.split('@');
        const taskIds = [1, 2, 3];

        for (const taskId of taskIds) {
            let options = {
                url: `https://integralapi.kuwo.cn/api/v1/online/sign/v1/earningSignIn/newDoListen?loginUid=${loginUid}&loginSid=${loginSid}&from=coinAccumulationTask&taskId=${taskId}`,
                headers: kw_headers,
            };

            $.log("🟡正在执行今日累计奖励任务...");
            try {
                let resp = await $.http.get(options);
                if (logs === 1) {
                    console.log('今日累计奖励任务调试响应体：', resp.body);
                }

                let obj = JSON.parse(resp.body);
                let desc;

                if (obj.code === 200 && obj.msg === "success" && obj.success === true && obj.data.obtain !== 0) {
                    desc = obj.data.description;
                    if (obj.data.status === 1) desc = `🎉今日累计奖励任务: ${desc}`;
                    else if (obj.data.status === 0) desc = `🟢今日累计奖励任务: ${desc}`;
                    else if (desc === "用户未登录") desc = `🔴今日累计奖励任务: ${desc}`;
                    else desc = `⚠️今日累计奖励任务: ${desc}`;
                } else {
                    desc = `❌今日累计奖励任务: 错误!`;
                    $.log(resp.body);
                }

                $.log(desc);
                notifyMsg.push(desc);

            } catch (e) {
                $.log(`❌今日累计奖励任务 执行出错: ${e}`);
            }
        }
        resolve();
    });
}



async function loterry_free(ID) {
    const [loginUid, loginSid] = ID.split('@');
    let options = {
        url: `https://integralapi.kuwo.cn/api/v1/online/sign/loterry/getLucky?loginUid=${loginUid}&loginSid=${loginSid}&type=free`,
        headers: kw_headers,
    };

    return $.http.get(options).then((resp) => {
        $.log("🟡正在执行免费抽奖任务...");
        if (logs === 1) {
            console.log('免费抽奖任务调试响应体：',resp.body);
        }
        var desc;
        var obj = JSON.parse(resp.body);
        if (obj.code === 200 && obj.msg === "success" && obj.success === true) {
            desc = obj.data.loterryname ? `🎉免费抽奖: ${obj.data.loterryname}` : `❌免费抽奖: 错误!`;
        } else desc = obj.msg ? `🔴免费抽奖: ${obj.msg}` : `❌免费抽奖: 错误!`;
        if (desc === `🔴免费抽奖: 免费次数用完了`) {
            desc = `🟢免费抽奖: 免费次数用完了`;
        }
        if (desc === `❌免费抽奖: 错误!`) {
            $.log(resp.body);
        }
        $.log(desc);
        notifyMsg.push(desc);
    });
}

async function loterry_video(ID) {
    const [loginUid, loginSid] = ID.split('@');
    let options = {
        url: `https://integralapi.kuwo.cn/api/v1/online/sign/loterry/getLucky?loginUid=${loginUid}&loginSid=${loginSid}&type=video`,
        headers: kw_headers,
    };

    return $.http.get(options).then((resp) => {
        $.log("🟡正在执行视频抽奖任务...");
        if (logs === 1) {
            console.log('视频抽奖任务调试响应体：',resp.body);
        }
        var desc;
        var obj = JSON.parse(resp.body);
        if (obj.code === 200 && obj.msg === "success" && obj.success === true) {
            desc = obj.data.loterryname ? `🎉视频抽奖: ${obj.data.loterryname}` : `❌视频抽奖: 错误!`;
        } else desc = obj.msg ? `🔴视频抽奖: ${obj.msg}` : `❌视频抽奖: 错误!`;
        if (desc === `🔴视频抽奖: 视频次数用完了`) {
            desc = `🟢视频抽奖: 视频次数用完了`;
        }
        if (desc === `❌视频抽奖: 错误!`) {
            $.log(resp.body);
        }
        $.log(desc);
        notifyMsg.push(desc);
    });
}

// 惊喜任务
let surpriseState = new Map();

function getAccountState(ID) {
    if (!surpriseState.has(ID)) {
        surpriseState.set(ID, {
            runCount: 0,           // 已运行次数
            lastRunTime: 0,        // 上次运行时间
            lastResetDay: new Date().getDate(),
            currentMinInterval: 30 // 初始间隔 (分钟)
        });
    }
    return surpriseState.get(ID);
}

// 生成一个新的随机间隔 (30 ~ 60 分钟)
function getRandomInterval() {
    return Math.floor(Math.random() * (60 - 30 + 1)) + 30;
}

// 检查是否在允许的时间段内 (08:00 ~ 23:00)
function isAllowedTime() {
    const hour = new Date().getHours();
    return hour >= 7 && hour < 12;
}

async function surprise(ID, time) {
    const now = new Date();
    const today = now.getDate();
    const [loginUid, loginSid] = ID.split('@');
    let state = getAccountState(ID);  // 获取账号独立状态

    // 获取昵称
    //let nickname = await getNickname(ID) || loginUid;

    // 每天 0:00~7:00 之间重置计数和时间
    const nowHour = now.getHours();
    if (today !== state.lastResetDay && nowHour >= 0 && nowHour < 7) {
        state.runCount = 0;
        state.lastRunTime = 0;
        state.lastResetDay = today;
        state.currentMinInterval = 30;
        $.log(`🔄 已重置惊喜任务计数)`);
    }

    // 限制每天最多 5 次
    if (state.runCount >= 6) {
        $.log(`🚫 惊喜任务已达今日最大运行次数(6次)，跳过...`);
        return;
    }

    // 限制运行间隔 (30~60 分钟随机)
    const nowTime = now.getTime();
    if (state.lastRunTime && (nowTime - state.lastRunTime) < state.currentMinInterval * 60 * 1000) {
        $.log(`⏳上次运行间隔不足 ${state.currentMinInterval} 分钟，跳过...`);
        return;
    }

    // 检查是否在允许的时间段内
    if (!isAllowedTime()) {
        $.log(`⏰ 当前时间不在 07:00~12:00 之间，跳过惊喜任务...`);
        return;
    }

    // goldNum 随机
    const goldNum = Math.random() < 0.3 ? 68 : (Math.random() < 0.6 ? 69 : 70);

    let options = {
        url: `https://integralapi.kuwo.cn/api/v1/online/sign/v1/earningSignIn/newDoListen?loginUid=${loginUid}&loginSid=${loginSid}&from=surprise&goldNum=${goldNum}&time=${time}&surpriseType=1`,
        headers: kw_headers,
    };

    try {
        const resp = await $.http.get(options);
        $.log(`🟡 正在执行惊喜任务...`);

        if (logs === 1) console.log('惊喜任务调试响应体：', resp.body);

        let obj = JSON.parse(resp.body);
        let desc;

        if (obj.code === 200 && obj.msg === "success" && obj.success === true) {
            desc = obj.data.description;

            if (obj.data.status === 1) desc = `🎉惊喜任务: ${desc}`;
            else if (obj.data.status === 0) desc = `🟢惊喜任务: ${desc}`;
            else if (desc === "用户未登录") desc = `🔴惊喜任务: ${desc}`;
            else desc = `⚠️惊喜任务: ${desc}`;

            // 更新运行次数和时间
            state.runCount++;
            state.lastRunTime = nowTime;
            state.currentMinInterval = getRandomInterval();  // 更新为新的随机间隔
            $.log(`🔀 下次最小间隔已随机设置为 ${state.currentMinInterval} 分钟)`);

        } else {
            desc = `惊喜任务: ${obj.msg || "错误!"}`;
            $.log(resp.body);
        }

        $.log(desc);
        notifyMsg.push(desc);

    } catch (e) {
        $.log(`惊喜任务: 请求或解析失败`, e);
        notifyMsg.push(`惊喜任务: 请求或解析失败`);
    }
}

async function box(ID) {
    // 定时宝箱,可以强制领取,但不推荐!
    var times = [];
    var hour = new Date().getUTCHours() + 8;

    if (hour >= 0) {
        times.push("00-08");
    }
    if (hour >= 8) {
        times.push("08-10");
    }
    if (hour >= 10) {
        times.push("10-12");
    }
    if (hour >= 12) {
        times.push("12-14");
    }
    if (hour >= 14) {
        times.push("14-16");
    }
    if (hour >= 16) {
        times.push("16-18");
    }
    if (hour >= 18) {
        times.push("18-20");
    }
    if (hour >= 20) {
        times.push("20-24");
    }

    var len = times.length;

    await box_new(ID, times[len - 1]);

    for (var i = 0; i < len - 1; i++) {
        // console.log(time[i]);
        await box_old(ID,times[i]);
    }
}

async function box_new(ID, time) {
    const [loginUid, loginSid] = ID.split('@');
    var rand = Math.random() < 0.3 ? 28 : Math.random() < 0.6 ? 29 : 30;
    //console.log(`调试：${loginUid}....${loginSid}`)
    let options = {
        url: `https://integralapi.kuwo.cn/api/v1/online/sign/new/boxRenew?loginUid=${loginUid}&loginSid=${loginSid}&action=new&time=${time}&goldNum=${rand}`,
        headers: kw_headers,
    };

    return $.http.get(options).then((resp) => {
        $.log("🟡正在执行定时宝箱任务...");
        if (logs === 1) {
            console.log('定时宝箱任务调试响应体：',resp.body);
        }
        var desc;
        var obj = JSON.parse(resp.body);
        if (obj.code === 200 && obj.msg === "success" && obj.success === true) {
            desc = obj.data.description;
            if (desc === "成功") desc = `🎉定时宝箱: ${desc}`;
            else if (desc === "今天已完成任务") desc = `🟢定时宝箱: ${desc}`;
            else if (desc === "用户未登录") desc = `🔴定时宝箱: ${desc}`;
            else desc = `⚠️定时宝箱: ${desc}`;
        } else {
            desc = `❌定时宝箱: 错误!`;
            $.log(resp.body);
        }
        $.log(desc);
        notifyMsg.push(desc);
    });
}

async function box_old(ID, time) {
    const [loginUid, loginSid] = ID.split('@');
    var rand = Math.random() < 0.3 ? 28 : Math.random() < 0.6 ? 29 : 30;

    let options = {
        url: `https://integralapi.kuwo.cn/api/v1/online/sign/new/boxRenew?loginUid=${loginUid}&loginSid=${loginSid}&action=old&time=${time}&goldNum=${rand}`,
        headers: kw_headers,
    };

    return $.http.get(options).then((resp) => {
        $.log("🟡正在执行补领宝箱任务...");
        if (logs === 1) {
            console.log('补领宝箱任务调试响应体：',resp.body);
        }
        var desc;
        var obj = JSON.parse(resp.body);
        if (obj.code === 200 && obj.msg === "success" && obj.success === true) {
            desc = obj.data.description;
            if (desc === "成功") desc = `🎉补领宝箱: ${desc}`;
            else if (desc === "今天已完成任务") desc = `🟢补领宝箱: ${desc}`;
            else if (desc === "用户未登录") desc = `🔴补领宝箱: ${desc}`;
            else desc = `⚠️补领宝箱: ${desc}`;
        } else {
            desc = `❌补领宝箱: 错误!`;
            $.log(resp.body);
        }
        $.log(desc);
        notifyMsg.push(desc);
    });
}


// 活动宝箱任务：查询奖励金额 + 补领
async function BoxTask(ID, time) {
    const [loginUid, loginSid] = ID.split('@');

    // 查询奖励金额
    let listOptions = {
        url: `https://integralapi.kuwo.cn/api/v1/online/sign/new/newBoxList?loginUid=${loginUid}&loginSid=${loginSid}&from=sign&extraGoldNum=110`,
        headers: kw_headers,
    };

    return $.http.get(listOptions).then((resp) => {
        $.log("🟡正在执行活动宝箱奖励金额查询任务...");
        if (logs === 1) console.log('活动宝箱奖励金额查询调试响应体：', resp.body);

        let data = JSON.parse(resp.body);
        let goldNum = 0;

        if (data.code === 200 && data.msg === "success" && data.success === true) {
            goldNum = data.data.goldNum;
            console.log(`🟢可获得金币: ${goldNum}`);
        } else {
            console.log(`❌宝箱奖励查询失败: ${data.msg}`);
            notifyMsg.push(`❌宝箱奖励查询失败: ${data.msg}`);
            return;
        }

        // 用查询到的 goldNum 补领奖励
        let finishOptions = {
            url: `https://integralapi.kuwo.cn/api/v1/online/sign/new/newBoxFinish?loginUid=${loginUid}&loginSid=${loginSid}&action=new&time=${time}&goldNum=${goldNum}&baseTaskGold=0&extraGoldNum=0&clickExtraGoldNum=0&yyzdSecondRewardFlag=0&secondRewardFlag=0&apiv=6`,
            headers: kw_headers,
        };

        return $.http.get(finishOptions).then((finishResp) => {
            $.log("🟡正在执行活动宝箱任务...");
            if (logs === 1) console.log('活动宝箱任务调试响应体：', finishResp.body);

            let desc;
            let obj = JSON.parse(finishResp.body);
            if (obj.code === 200 && obj.msg === "success" && obj.success === true) {
                desc = obj.data.description;
                if (desc === "成功") desc = `🎉活动宝箱: ${desc} (获得金币 ${goldNum})`;
                else if (obj.data.status === 0) desc = `🟢活动宝箱: ${desc}`;
                else if (desc === "用户未登录") desc = `🔴活动宝箱: ${desc}`;
                else desc = `⚠️活动宝箱: ${desc}`;
            } else {
                desc = `❌活动宝箱: 错误!`;
                $.log(finishResp.body);
            }
            $.log(desc);
            notifyMsg.push(desc);
        });
    });
}



async function Convert(ID) {
    const [loginUid, loginSid] = ID.split('@');
    var rand = Math.random() < 0.3 ? 68 : Math.random() < 0.6 ? 69 : 70;

    let options = {
        url: `https://integralapi.kuwo.cn/api/v1/online/sign/getExchangeAward?loginUid=${loginUid}&loginSid=${loginSid}&platform=ios&source=kwplayer_ip_11.1.0.0_TJ.ipa&version=11.1.0.0&quotaId=13&exchangeType=vip`,
        headers: kw_headers,
    };

    return $.http.get(options).then((resp) => {
        $.log("🟡正在执行会员兑换任务...");
        if (logs === 1) {
            console.log('会员兑换任务调试响应体：',resp.body);
        }
        var desc;
        var obj = JSON.parse(resp.body);
        if (obj.code === 200 && obj.msg === "success" && obj.success === true) {
            desc = obj.data.description;
            if (desc === "成功") desc = `🎉会员兑换: ${desc}`;
            else if (desc === "您的余额不足，继续做任务赚金币吧") desc = `🔴会员兑换: ${desc}`;
            else if (desc === "用户未登录") desc = `🔴会员兑换: ${desc}`;
            else desc = `⚠️会员兑换: ${desc}`;
        } else {
            desc = `❌会员兑换: 错误!`;
            $.log(resp.body);
        }
        $.log(desc);
        notifyMsg.push(desc);
    });
}

//整点打卡
async function Clockin(ID) {
    const [loginUid, loginSid] = ID.split('@');

    let options = {
        url: `https://integralapi.kuwo.cn/api/v1/online/sign/v1/earningSignIn/newDoListen?loginUid=${loginUid}&loginSid=${loginSid}&from=clock&goldNum=59`,
        headers: kw_headers,
    };

    return $.http.get(options).then((resp) => {
        $.log("🟡正在执行整点打卡任务...");
        if (logs === 1) {
            console.log('整点打卡任务调试响应体：',resp.body);
        }
        var desc;
        var obj = JSON.parse(resp.body);
        if (obj.code === 200 && obj.msg === "success" && obj.success === true) {
            desc = obj.data.description;
            if (obj.data.status === 1) desc = `🎉整点打卡: ${desc}`;
            else if (obj.data.status === 0) desc = `🟢整点打卡: ${desc}`;
            else if (desc === "用户未登录") desc = `🔴整点打卡: ${desc}`;
            else desc = `⚠️整点打卡任务: ${desc}`;
        } else {
            desc = `❌整点打卡任务: 错误!`;
            $.log(resp.body);
        }
        $.log(desc);
        notifyMsg.push(desc);
    });
}


function Env(t, s) {
    class e {
        constructor(t) {
            this.env = t;
        }
        send(t, s = "GET") {
            t = "string" == typeof t ? { url: t } : t;
            let e = this.get;
            return (
                "POST" === s && (e = this.post),
                    new Promise((s, i) => {
                        e.call(this, t, (t, e, r) => {
                            t ? i(t) : s(e);
                        });
                    })
            );
        }
        get(t) {
            return this.send.call(this.env, t);
        }
        post(t) {
            return this.send.call(this.env, t, "POST");
        }
    }
    return new (class {
        constructor(t, s) {
            (this.name = t),
                (this.http = new e(this)),
                (this.data = null),
                (this.dataFile = "box.dat"),
                (this.logs = []),
                (this.isMute = !1),
                (this.isNeedRewrite = !1),
                (this.logSeparator = "\n"),
                (this.encoding = "utf-8"),
                (this.startTime = new Date().getTime()),
                Object.assign(this, s),
                this.log("", `\ud83d\udd14${this.name}, \u5f00\u59cb!`);
        }
        isNode() {
            return "undefined" != typeof module && !!module.exports;
        }
        isQuanX() {
            return "undefined" != typeof $task;
        }
        isSurge() {
            return "undefined" != typeof $environment && $environment["surge-version"];
        }
        isLoon() {
            return "undefined" != typeof $loon;
        }
        isShadowrocket() {
            return "undefined" != typeof $rocket;
        }
        isStash() {
            return "undefined" != typeof $environment && $environment["stash-version"];
        }
        toObj(t, s = null) {
            try {
                return JSON.parse(t);
            } catch {
                return s;
            }
        }
        toStr(t, s = null) {
            try {
                return JSON.stringify(t);
            } catch {
                return s;
            }
        }
        getjson(t, s) {
            let e = s;
            const i = this.getdata(t);
            if (i)
                try {
                    e = JSON.parse(this.getdata(t));
                } catch { }
            return e;
        }
        setjson(t, s) {
            try {
                return this.setdata(JSON.stringify(t), s);
            } catch {
                return !1;
            }
        }
        getScript(t) {
            return new Promise((s) => {
                this.get({ url: t }, (t, e, i) => s(i));
            });
        }
        runScript(t, s) {
            return new Promise((e) => {
                let i = this.getdata("@chavy_boxjs_userCfgs.httpapi");
                i = i ? i.replace(/\n/g, "").trim() : i;
                let r = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");
                (r = r ? 1 * r : 20), (r = s && s.timeout ? s.timeout : r);
                const [o, h] = i.split("@"),
                    a = {
                        url: `http://${h}/v1/scripting/evaluate`,
                        body: { script_text: t, mock_type: "cron", timeout: r },
                        headers: { "X-Key": o, Accept: "*/*" },
                        timeout: r,
                    };
                this.post(a, (t, s, i) => e(i));
            }).catch((t) => this.logErr(t));
        }
        loaddata() {
            if (!this.isNode()) return {};
            {
                (this.fs = this.fs ? this.fs : require("fs")),
                    (this.path = this.path ? this.path : require("path"));
                const t = this.path.resolve(this.dataFile),
                    s = this.path.resolve(process.cwd(), this.dataFile),
                    e = this.fs.existsSync(t),
                    i = !e && this.fs.existsSync(s);
                if (!e && !i) return {};
                {
                    const i = e ? t : s;
                    try {
                        return JSON.parse(this.fs.readFileSync(i));
                    } catch (t) {
                        return {};
                    }
                }
            }
        }
        writedata() {
            if (this.isNode()) {
                (this.fs = this.fs ? this.fs : require("fs")),
                    (this.path = this.path ? this.path : require("path"));
                const t = this.path.resolve(this.dataFile),
                    s = this.path.resolve(process.cwd(), this.dataFile),
                    e = this.fs.existsSync(t),
                    i = !e && this.fs.existsSync(s),
                    r = JSON.stringify(this.data);
                e
                    ? this.fs.writeFileSync(t, r)
                    : i
                        ? this.fs.writeFileSync(s, r)
                        : this.fs.writeFileSync(t, r);
            }
        }
        lodash_get(t, s, e) {
            const i = s.replace(/\[(\d+)\]/g, ".$1").split(".");
            let r = t;
            for (const t of i) if (((r = Object(r)[t]), void 0 === r)) return e;
            return r;
        }
        lodash_set(t, s, e) {
            return Object(t) !== t
                ? t
                : (Array.isArray(s) || (s = s.toString().match(/[^.[\]]+/g) || []),
                    (s
                        .slice(0, -1)
                        .reduce(
                            (t, e, i) =>
                                Object(t[e]) === t[e]
                                    ? t[e]
                                    : (t[e] = Math.abs(s[i + 1]) >> 0 == +s[i + 1] ? [] : {}),
                            t
                        )[s[s.length - 1]] = e),
                    t);
        }
        getdata(t) {
            let s = this.getval(t);
            if (/^@/.test(t)) {
                const [, e, i] = /^@(.*?)\.(.*?)$/.exec(t),
                    r = e ? this.getval(e) : "";
                if (r)
                    try {
                        const t = JSON.parse(r);
                        s = t ? this.lodash_get(t, i, "") : s;
                    } catch (t) {
                        s = "";
                    }
            }
            return s;
        }
        setdata(t, s) {
            let e = !1;
            if (/^@/.test(s)) {
                const [, i, r] = /^@(.*?)\.(.*?)$/.exec(s),
                    o = this.getval(i),
                    h = i ? ("null" === o ? null : o || "{}") : "{}";
                try {
                    const s = JSON.parse(h);
                    this.lodash_set(s, r, t), (e = this.setval(JSON.stringify(s), i));
                } catch (s) {
                    const o = {};
                    this.lodash_set(o, r, t), (e = this.setval(JSON.stringify(o), i));
                }
            } else e = this.setval(t, s);
            return e;
        }
        getval(t) {
            return this.isSurge() || this.isShadowrocket() || this.isLoon() || this.isStash()
                ? $persistentStore.read(t)
                : this.isQuanX()
                    ? $prefs.valueForKey(t)
                    : this.isNode()
                        ? ((this.data = this.loaddata()), this.data[t])
                        : (this.data && this.data[t]) || null;
        }
        setval(t, s) {
            return this.isSurge() || this.isShadowrocket() || this.isLoon() || this.isStash()
                ? $persistentStore.write(t, s)
                : this.isQuanX()
                    ? $prefs.setValueForKey(t, s)
                    : this.isNode()
                        ? ((this.data = this.loaddata()), (this.data[s] = t), this.writedata(), !0)
                        : (this.data && this.data[s]) || null;
        }
        initGotEnv(t) {
            (this.got = this.got ? this.got : require("got")),
                (this.cktough = this.cktough ? this.cktough : require("tough-cookie")),
                (this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar()),
            t &&
            ((t.headers = t.headers ? t.headers : {}),
            void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar));
        }
        get(t, s = () => { }) {
            if (
                (t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"]),
                this.isSurge() || this.isShadowrocket() || this.isLoon() || this.isStash())
            )
                this.isSurge() &&
                this.isNeedRewrite &&
                ((t.headers = t.headers || {}),
                    Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })),
                    $httpClient.get(t, (t, e, i) => {
                        !t &&
                        e &&
                        ((e.body = i),
                            (e.statusCode = e.status ? e.status : e.statusCode),
                            (e.status = e.statusCode)),
                            s(t, e, i);
                    });
            else if (this.isQuanX())
                this.isNeedRewrite && ((t.opts = t.opts || {}), Object.assign(t.opts, { hints: !1 })),
                    $task.fetch(t).then(
                        (t) => {
                            const { statusCode: e, statusCode: i, headers: r, body: o } = t;
                            s(null, { status: e, statusCode: i, headers: r, body: o }, o);
                        },
                        (t) => s((t && t.error) || "UndefinedError")
                    );
            else if (this.isNode()) {
                let e = require("iconv-lite");
                this.initGotEnv(t),
                    this.got(t)
                        .on("redirect", (t, s) => {
                            try {
                                if (t.headers["set-cookie"]) {
                                    const e = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();
                                    e && this.ckjar.setCookieSync(e, null), (s.cookieJar = this.ckjar);
                                }
                            } catch (t) {
                                this.logErr(t);
                            }
                        })
                        .then(
                            (t) => {
                                const { statusCode: i, statusCode: r, headers: o, rawBody: h } = t,
                                    a = e.decode(h, this.encoding);
                                s(null, { status: i, statusCode: r, headers: o, rawBody: h, body: a }, a);
                            },
                            (t) => {
                                const { message: i, response: r } = t;
                                s(i, r, r && e.decode(r.rawBody, this.encoding));
                            }
                        );
            }
        }
        post(t, s = () => { }) {
            const e = t.method ? t.method.toLocaleLowerCase() : "post";
            if (
                (t.body &&
                t.headers &&
                !t.headers["Content-Type"] &&
                (t.headers["Content-Type"] = "application/x-www-form-urlencoded"),
                t.headers && delete t.headers["Content-Length"],
                this.isSurge() || this.isShadowrocket() || this.isLoon() || this.isStash())
            )
                this.isSurge() &&
                this.isNeedRewrite &&
                ((t.headers = t.headers || {}),
                    Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })),
                    $httpClient[e](t, (t, e, i) => {
                        !t &&
                        e &&
                        ((e.body = i),
                            (e.statusCode = e.status ? e.status : e.statusCode),
                            (e.status = e.statusCode)),
                            s(t, e, i);
                    });
            else if (this.isQuanX())
                (t.method = e),
                this.isNeedRewrite && ((t.opts = t.opts || {}), Object.assign(t.opts, { hints: !1 })),
                    $task.fetch(t).then(
                        (t) => {
                            const { statusCode: e, statusCode: i, headers: r, body: o } = t;
                            s(null, { status: e, statusCode: i, headers: r, body: o }, o);
                        },
                        (t) => s((t && t.error) || "UndefinedError")
                    );
            else if (this.isNode()) {
                let i = require("iconv-lite");
                this.initGotEnv(t);
                const { url: r, ...o } = t;
                this.got[e](r, o).then(
                    (t) => {
                        const { statusCode: e, statusCode: r, headers: o, rawBody: h } = t,
                            a = i.decode(h, this.encoding);
                        s(null, { status: e, statusCode: r, headers: o, rawBody: h, body: a }, a);
                    },
                    (t) => {
                        const { message: e, response: r } = t;
                        s(e, r, r && i.decode(r.rawBody, this.encoding));
                    }
                );
            }
        }
        time(t, s = null) {
            const e = s ? new Date(s) : new Date();
            let i = {
                "M+": e.getMonth() + 1,
                "d+": e.getDate(),
                "H+": e.getHours(),
                "m+": e.getMinutes(),
                "s+": e.getSeconds(),
                "q+": Math.floor((e.getMonth() + 3) / 3),
                S: e.getMilliseconds(),
            };
            /(y+)/.test(t) &&
            (t = t.replace(RegExp.$1, (e.getFullYear() + "").substr(4 - RegExp.$1.length)));
            for (let s in i)
                new RegExp("(" + s + ")").test(t) &&
                (t = t.replace(
                    RegExp.$1,
                    1 == RegExp.$1.length ? i[s] : ("00" + i[s]).substr(("" + i[s]).length)
                ));
            return t;
        }
        queryStr(t) {
            let s = "";
            for (const e in t) {
                let i = t[e];
                null != i &&
                "" !== i &&
                ("object" == typeof i && (i = JSON.stringify(i)), (s += `${e}=${i}&`));
            }
            return (s = s.substring(0, s.length - 1)), s;
        }
        msg(s = t, e = "", i = "", r) {
            const o = (t) => {
                if (!t) return t;
                if ("string" == typeof t)
                    return this.isLoon() || this.isShadowrocket()
                        ? t
                        : this.isQuanX()
                            ? { "open-url": t }
                            : this.isSurge() || this.isStash()
                                ? { url: t }
                                : void 0;
                if ("object" == typeof t) {
                    if (this.isLoon()) {
                        let s = t.openUrl || t.url || t["open-url"],
                            e = t.mediaUrl || t["media-url"];
                        return { openUrl: s, mediaUrl: e };
                    }
                    if (this.isQuanX()) {
                        let s = t["open-url"] || t.url || t.openUrl,
                            e = t["media-url"] || t.mediaUrl,
                            i = t["update-pasteboard"] || t.updatePasteboard;
                        return { "open-url": s, "media-url": e, "update-pasteboard": i };
                    }
                    if (this.isSurge() || this.isShadowrocket() || this.isStash()) {
                        let s = t.url || t.openUrl || t["open-url"];
                        return { url: s };
                    }
                }
            };
            if (
                (this.isMute ||
                (this.isSurge() || this.isShadowrocket() || this.isLoon() || this.isStash()
                    ? $notification.post(s, e, i, o(r))
                    : this.isQuanX() && $notify(s, e, i, o(r))),
                    !this.isMuteLog)
            ) {
                let t = [
                    "",
                    "==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3==============",
                ];
                t.push(s),
                e && t.push(e),
                i && t.push(i),
                    console.log(t.join("\n")),
                    (this.logs = this.logs.concat(t));
            }
        }
        log(...t) {
            t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator));
        }
        logErr(t, s) {
            const e = !(
                this.isSurge() ||
                this.isShadowrocket() ||
                this.isQuanX() ||
                this.isLoon() ||
                this.isStash()
            );
            e
                ? this.log("", `\u2757\ufe0f${this.name}, \u9519\u8bef!`, t.stack)
                : this.log("", `\u2757\ufe0f${this.name}, \u9519\u8bef!`, t);
        }
        wait(t) {
            return new Promise((s) => setTimeout(s, t));
        }
        done(t = {}) {
            const s = new Date().getTime(),
                e = (s - this.startTime) / 1e3;
            this.log("", `\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${e} \u79d2`),
                this.log(),
                this.isSurge() || this.isShadowrocket() || this.isQuanX() || this.isLoon() || this.isStash()
                    ? $done(t)
                    : this.isNode() && process.exit(1);
        }
    })(t, s);
}
