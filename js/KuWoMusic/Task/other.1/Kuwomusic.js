/*
APP：酷我音乐
版本：/////
作者：General℡

脚本功能：看广告，获取更多的免费听歌时间！不管你有没有刷广告入口都能用

更新：优化通知，更新多账号支持

操作：在网页酷我音乐上登陆，手机端需切换到桌面版才有登录口，登陆成功后切回移动版，成功获取Cookies！
 更新登录信息后禁用脚本!

 ⏰⏰⏰特别提醒⏰⏰⏰：【酷我音乐积分】已增加会员兑换，所以这个脚本意义已经不大

注意⚠️：当前脚本只测试Loon，node.js 其他自测！
可配合其他酷我音乐会员脚本去掉部分广告（没时间搞广告）




使用声明：⚠️⚠️⚠️此脚本仅供学习与交流，
        请勿贩卖！⚠️⚠️⚠️

[Script]

 Cookie获取已和 【酷我音乐积分】合并

[Task]
cron "3 6 * * * script-path=https://raw.githubusercontent.com/General74110/Scripts/master/Quantumult%20X/Script/Task/Kuwomusic.js, timeout=3600, tag=酷我音乐(时长), images-url=https://raw.githubusercontent.com/Semporia/Hand-Painted-icon/master/Social_Media/Bebo.png


*/

const $ = new Env('酷我音乐');

const loginUidArr = [];
const kuwoNameArr = [];
const notify = $.isNode() ? require('./sendNotify') : '';
let message = '';
let tz = $.getval('tz') || '1'; // 通知设置：0关闭通知，1开启通知
const logs = 0; // 日志设置：0关闭日志，1开启日志

// 检查是否在 Node.js 环境中
const isNode = typeof process !== "undefined" && process.env;

if (isNode) {
  // Node.js 环境下加载 .env 文件中的环境变量
  const dotenv = require('dotenv');
  dotenv.config();
}

// **读取存储的 KUWO_COOKIE，可能包含多个账号**
let storedIDs = $.getdata('Kuwo_cookies') || (isNode ? process.env.KUWO_COOKIE : '');
if (logs == 1) {
  console.log(`读取到的数据: ${storedIDs}`);
}

// **解析 ID，获取 loginUid**
if (storedIDs) {
  loginUidArr.push(...storedIDs.split('&').map(a => a.split('@')[0])); // 只取 `loginUid`
}

// **如果没有数据，则停止脚本**
if (loginUidArr.length === 0) {
  console.log('❌ 账号为空，请重新获取Cookies');
  $.done();
}

// **执行任务**
!(async () => {
  console.log(`检测到 ${loginUidArr.length} 个账号`);

  for (let i = 0; i < loginUidArr.length; i++) {
    const currentLoginUid = loginUidArr[i];

    // **获取昵称**
    const nickname = await getNickname(currentLoginUid);
    const displayName = nickname || `用户${i + 1}`;
    console.log(`开始执行 【এ ${displayName} এ】的任务`);

    if (!nickname) {
      console.log(`⚠️ 账号 ${currentLoginUid} Cookie 失效`);
      await sendNotification("酷我音乐(时长)", `⚠️ 【এ ${displayName} এ】Cookie 已失效，请更新`);
      continue;
    }

    kuwoNameArr[i] = displayName;

    // **执行刷时长任务**
    let totalMinutes = 0;
    let lastExpiryTime = '';
    let successMessage = '';

    const loopCount = Math.floor(Math.random() * 21) + 80; // 80~100次
    for (let c = 0; c < loopCount; c++) {
      $.index = c + 1;
      const taskResult = await Task(currentLoginUid);
      if (taskResult.success) {
        totalMinutes += taskResult.singleTime;
        lastExpiryTime = taskResult.expiryTime;
        successMessage = taskResult.message;
      }
      await $.wait(2000);
    }

    const totalHours = (totalMinutes / 60).toFixed(2);
    message = `【এ ${displayName} এ】\n` +
        `【状态】${successMessage}\n` +
        `【获得时长】${totalHours} 小时\n` +
        `【到期时间】${lastExpiryTime}\n`;

    await sendNotification("酷我音乐(时长)", message);
  }
})()
    .catch((e) => $.logErr(e))
    .finally(() => $.done());

/**
 * 发送通知
 */
async function sendNotification(title, content) {
  if (tz == 1) {
    if ($.isNode()) {
      await notify.sendNotify(title, content);
    } else {
      $.msg(title, '', content);
    }
  } else {
    console.log(content);
  }
}


// 获取昵称
async function getNickname(loginUid) {
  return new Promise((resolve) => {
    const options = {
      url: `https://integralapi.kuwo.cn/api/v1/online/sign/v1/music/userBase?loginUid=${loginUid}`,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'KuwoMusic/9.3.1 (iPhone; iOS 13.5; Scale/2.00)',  // 添加请求头中的 User-Agent
      }
    };
    $.get(options, (err, resp, data) => {
      if (logs == 1) {
        console.log('昵称原始响应体：', data)
      }
      try {
        if (err) {
          $.logErr(`获取昵称失败：${err}`);
          resolve('');
          return;
        }

        data = JSON.parse(data);
        const nickname = data.data.nickname;
        $.nickName = data;
        resolve(nickname);
      } catch (e) {
        $.logErr(e);
        resolve('');
      }
    });
  });
}

// 看广告
async function Task(loginUid, timeout = 0) {
  return new Promise((resolve) => {
    let body = `{"loginUid":${loginUid},"status":1}`;
    let id = '4fa52cded158167889c619a928521b8a'
    setTimeout(() => {
      let url = {
        url: `https://wapi.kuwo.cn/openapi/v1/user/freemium/h5/switches?reqId=${id}`,
        headers: {
          'Content-Type':'application/json;;charset=utf-8'
        },
        body: body

      };

      $.post(url, async (err, resp, data) => {

        if (logs == 1) {
          console.log(`请求 URL: ${url.url}`);
          console.log(`请求体: ${url.body}`);
          console.log(`响应状态码: ${resp ? resp.status : '无响应'}`);
          console.log(`原始响应数据: ${data}`);
        }

        if (err) {
          $.logErr(`请求失败：${err}`);
          resolve({
            success: false,
            singleTime: 0,
            expiryTime: '',
            message: '请求失败',
          });
          return;
        }

        // 检查响应数据是否为空
        if (!data || data.trim() === '') {
          $.log(`响应数据为空`);
          resolve({
            success: false,
            singleTime: 0,
            expiryTime: '',
            message: '响应数据为空，任务失败',
          });
          return;
        }

        try {


          data = JSON.parse(data);

          if (data.code === 200) {
            let endTime = data.data.endTime;
            let date = new Date(Number(endTime));
            let dateString = date.toLocaleString();

            $.log(
                `${data.msg}!✅\n` +
                `获得免费时长: ${data.data.singleTime} 分钟\n` +
                `到期时间: ${dateString}`
            );
            resolve({
              success: true,
              singleTime: parseFloat(data.data.singleTime),
              expiryTime: dateString,
              message: `${data.msg}!✅`,
            });
          } else if (data.code === -1) {
            $.log(`${data.msg}! 等明天吧！❎`);
            resolve({
              success: false,
              singleTime: 0,
              expiryTime: '',
              message: `${data.msg}! 等明天吧！❎`,
            });
          } else {
            $.log(`${data.msg}! 可能是 Cookie 无效🆘`);
            resolve({
              success: false,
              singleTime: 0,
              expiryTime: '',
              message: `${data.msg}! 可能是 Cookie 无效🆘`,
            });
          }
        } catch (e) {
          $.logErr(`解析 JSON 出错: ${e}`);
          console.log(`原始响应数据解析失败: ${data}`);
          resolve({
            success: false,
            singleTime: 0,
            expiryTime: '',
            message: '未知错误',
          });
        }
      });
    }, timeout);
  });
}

async function showmsg() {
  if (tz == 1) {
    if ($.isNode()) {
      await notify.sendNotify($.name, message);
    } else {
      $.msg($.name, '', message);
    }
  } else {
    console.log(message);
  }
}

// https://github.com/chavyleung/scripts/blob/master/Env.min.js
/*********************************** API *************************************/
function Env(t, e) {
  class s {
    constructor(t) {
      this.env = t;
    }
    send(t, e = 'GET') {
      t = 'string' == typeof t ? { url: t } : t;
      let s = this.get;
      return (
          'POST' === e && (s = this.post),
              new Promise((e, a) => {
                s.call(this, t, (t, s, r) => {
                  t ? a(t) : e(s);
                });
              })
      );
    }
    get(t) {
      return this.send.call(this.env, t);
    }
    post(t) {
      return this.send.call(this.env, t, 'POST');
    }
  }
  return new (class {
    constructor(t, e) {
      (this.name = t),
          (this.http = new s(this)),
          (this.data = null),
          (this.dataFile = 'box.dat'),
          (this.logs = []),
          (this.isMute = !1),
          (this.isNeedRewrite = !1),
          (this.logSeparator = '\n'),
          (this.encoding = 'utf-8'),
          (this.startTime = new Date().getTime()),
          Object.assign(this, e),
          this.log('', `🔔${this.name}, 开始!`);
    }
    getEnv() {
      return 'undefined' != typeof $environment && $environment['surge-version']
          ? 'Surge'
          : 'undefined' != typeof $environment && $environment['stash-version']
              ? 'Stash'
              : 'undefined' != typeof module && module.exports
                  ? 'Node.js'
                  : 'undefined' != typeof $task
                      ? 'Quantumult X'
                      : 'undefined' != typeof $loon
                          ? 'Loon'
                          : 'undefined' != typeof $rocket
                              ? 'Shadowrocket'
                              : void 0;
    }
    isNode() {
      return 'Node.js' === this.getEnv();
    }
    isQuanX() {
      return 'Quantumult X' === this.getEnv();
    }
    isSurge() {
      return 'Surge' === this.getEnv();
    }
    isLoon() {
      return 'Loon' === this.getEnv();
    }
    isShadowrocket() {
      return 'Shadowrocket' === this.getEnv();
    }
    isStash() {
      return 'Stash' === this.getEnv();
    }
    toObj(t, e = null) {
      try {
        return JSON.parse(t);
      } catch {
        return e;
      }
    }
    toStr(t, e = null) {
      try {
        return JSON.stringify(t);
      } catch {
        return e;
      }
    }
    getjson(t, e) {
      let s = e;
      const a = this.getdata(t);
      if (a)
        try {
          s = JSON.parse(this.getdata(t));
        } catch {}
      return s;
    }
    setjson(t, e) {
      try {
        return this.setdata(JSON.stringify(t), e);
      } catch {
        return !1;
      }
    }
    getScript(t) {
      return new Promise((e) => {
        this.get({ url: t }, (t, s, a) => e(a));
      });
    }
    runScript(t, e) {
      return new Promise((s) => {
        let a = this.getdata('@chavy_boxjs_userCfgs.httpapi');
        a = a ? a.replace(/\n/g, '').trim() : a;
        let r = this.getdata('@chavy_boxjs_userCfgs.httpapi_timeout');
        (r = r ? 1 * r : 20), (r = e && e.timeout ? e.timeout : r);
        const [i, o] = a.split('@'),
            n = {
              url: `http://${o}/v1/scripting/evaluate`,
              body: { script_text: t, mock_type: 'cron', timeout: r },
              headers: { 'X-Key': i, Accept: '*/*' },
              timeout: r,
            };
        this.post(n, (t, e, a) => s(a));
      }).catch((t) => this.logErr(t));
    }
    loaddata() {
      if (!this.isNode()) return {};
      {
        (this.fs = this.fs ? this.fs : require('fs')),
            (this.path = this.path ? this.path : require('path'));
        const t = this.path.resolve(this.dataFile),
            e = this.path.resolve(process.cwd(), this.dataFile),
            s = this.fs.existsSync(t),
            a = !s && this.fs.existsSync(e);
        if (!s && !a) return {};
        {
          const a = s ? t : e;
          try {
            return JSON.parse(this.fs.readFileSync(a));
          } catch (t) {
            return {};
          }
        }
      }
    }
    writedata() {
      if (this.isNode()) {
        (this.fs = this.fs ? this.fs : require('fs')),
            (this.path = this.path ? this.path : require('path'));
        const t = this.path.resolve(this.dataFile),
            e = this.path.resolve(process.cwd(), this.dataFile),
            s = this.fs.existsSync(t),
            a = !s && this.fs.existsSync(e),
            r = JSON.stringify(this.data);
        s
            ? this.fs.writeFileSync(t, r)
            : a
                ? this.fs.writeFileSync(e, r)
                : this.fs.writeFileSync(t, r);
      }
    }
    lodash_get(t, e, s) {
      const a = e.replace(/\[(\d+)\]/g, '.$1').split('.');
      let r = t;
      for (const t of a) if (((r = Object(r)[t]), void 0 === r)) return s;
      return r;
    }
    lodash_set(t, e, s) {
      return Object(t) !== t
          ? t
          : (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []),
              (e
                  .slice(0, -1)
                  .reduce(
                      (t, s, a) =>
                          Object(t[s]) === t[s]
                              ? t[s]
                              : (t[s] = Math.abs(e[a + 1]) >> 0 == +e[a + 1] ? [] : {}),
                      t
                  )[e[e.length - 1]] = s),
              t);
    }
    getdata(t) {
      let e = this.getval(t);
      if (/^@/.test(t)) {
        const [, s, a] = /^@(.*?)\.(.*?)$/.exec(t),
            r = s ? this.getval(s) : '';
        if (r)
          try {
            const t = JSON.parse(r);
            e = t ? this.lodash_get(t, a, '') : e;
          } catch (t) {
            e = '';
          }
      }
      return e;
    }
    setdata(t, e) {
      let s = !1;
      if (/^@/.test(e)) {
        const [, a, r] = /^@(.*?)\.(.*?)$/.exec(e),
            i = this.getval(a),
            o = a ? ('null' === i ? null : i || '{}') : '{}';
        try {
          const e = JSON.parse(o);
          this.lodash_set(e, r, t), (s = this.setval(JSON.stringify(e), a));
        } catch (e) {
          const i = {};
          this.lodash_set(i, r, t), (s = this.setval(JSON.stringify(i), a));
        }
      } else s = this.setval(t, e);
      return s;
    }
    getval(t) {
      switch (this.getEnv()) {
        case 'Surge':
        case 'Loon':
        case 'Stash':
        case 'Shadowrocket':
          return $persistentStore.read(t);
        case 'Quantumult X':
          return $prefs.valueForKey(t);
        case 'Node.js':
          return (this.data = this.loaddata()), this.data[t];
        default:
          return (this.data && this.data[t]) || null;
      }
    }
    setval(t, e) {
      switch (this.getEnv()) {
        case 'Surge':
        case 'Loon':
        case 'Stash':
        case 'Shadowrocket':
          return $persistentStore.write(t, e);
        case 'Quantumult X':
          return $prefs.setValueForKey(t, e);
        case 'Node.js':
          return (
              (this.data = this.loaddata()),
                  (this.data[e] = t),
                  this.writedata(),
                  !0
          );
        default:
          return (this.data && this.data[e]) || null;
      }
    }
    initGotEnv(t) {
      (this.got = this.got ? this.got : require('got')),
          (this.cktough = this.cktough ? this.cktough : require('tough-cookie')),
          (this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar()),
      t &&
      ((t.headers = t.headers ? t.headers : {}),
      void 0 === t.headers.Cookie &&
      void 0 === t.cookieJar &&
      (t.cookieJar = this.ckjar));
    }
    get(t, e = () => {}) {
      switch (
          (t.headers &&
          (delete t.headers['Content-Type'],
              delete t.headers['Content-Length'],
              delete t.headers['content-type'],
              delete t.headers['content-length']),
          t.params && (t.url += '?' + this.queryStr(t.params)),
              this.getEnv())
          ) {
        case 'Surge':
        case 'Loon':
        case 'Stash':
        case 'Shadowrocket':
        default:
          this.isSurge() &&
          this.isNeedRewrite &&
          ((t.headers = t.headers || {}),
              Object.assign(t.headers, { 'X-Surge-Skip-Scripting': !1 })),
              $httpClient.get(t, (t, s, a) => {
                !t &&
                s &&
                ((s.body = a),
                    (s.statusCode = s.status ? s.status : s.statusCode),
                    (s.status = s.statusCode)),
                    e(t, s, a);
              });
          break;
        case 'Quantumult X':
          this.isNeedRewrite &&
          ((t.opts = t.opts || {}), Object.assign(t.opts, { hints: !1 })),
              $task.fetch(t).then(
                  (t) => {
                    const {
                      statusCode: s,
                      statusCode: a,
                      headers: r,
                      body: i,
                      bodyBytes: o,
                    } = t;
                    e(
                        null,
                        {
                          status: s,
                          statusCode: a,
                          headers: r,
                          body: i,
                          bodyBytes: o,
                        },
                        i,
                        o
                    );
                  },
                  (t) => e((t && t.error) || 'UndefinedError')
              );
          break;
        case 'Node.js':
          let s = require('iconv-lite');
          this.initGotEnv(t),
              this.got(t)
                  .on('redirect', (t, e) => {
                    try {
                      if (t.headers['set-cookie']) {
                        const s = t.headers['set-cookie']
                            .map(this.cktough.Cookie.parse)
                            .toString();
                        s && this.ckjar.setCookieSync(s, null),
                            (e.cookieJar = this.ckjar);
                      }
                    } catch (t) {
                      this.logErr(t);
                    }
                  })
                  .then(
                      (t) => {
                        const {
                              statusCode: a,
                              statusCode: r,
                              headers: i,
                              rawBody: o,
                            } = t,
                            n = s.decode(o, this.encoding);
                        e(
                            null,
                            {
                              status: a,
                              statusCode: r,
                              headers: i,
                              rawBody: o,
                              body: n,
                            },
                            n
                        );
                      },
                      (t) => {
                        const { message: a, response: r } = t;
                        e(a, r, r && s.decode(r.rawBody, this.encoding));
                      }
                  );
      }
    }
    post(t, e = () => {}) {
      const s = t.method ? t.method.toLocaleLowerCase() : 'post';
      switch (
          (t.body &&
          t.headers &&
          !t.headers['Content-Type'] &&
          !t.headers['content-type'] &&
          (t.headers['content-type'] = 'application/x-www-form-urlencoded'),
          t.headers &&
          (delete t.headers['Content-Length'],
              delete t.headers['content-length']),
              this.getEnv())
          ) {
        case 'Surge':
        case 'Loon':
        case 'Stash':
        case 'Shadowrocket':
        default:
          this.isSurge() &&
          this.isNeedRewrite &&
          ((t.headers = t.headers || {}),
              Object.assign(t.headers, { 'X-Surge-Skip-Scripting': !1 })),
              $httpClient[s](t, (t, s, a) => {
                !t &&
                s &&
                ((s.body = a),
                    (s.statusCode = s.status ? s.status : s.statusCode),
                    (s.status = s.statusCode)),
                    e(t, s, a);
              });
          break;
        case 'Quantumult X':
          (t.method = s),
          this.isNeedRewrite &&
          ((t.opts = t.opts || {}), Object.assign(t.opts, { hints: !1 })),
              $task.fetch(t).then(
                  (t) => {
                    const {
                      statusCode: s,
                      statusCode: a,
                      headers: r,
                      body: i,
                      bodyBytes: o,
                    } = t;
                    e(
                        null,
                        {
                          status: s,
                          statusCode: a,
                          headers: r,
                          body: i,
                          bodyBytes: o,
                        },
                        i,
                        o
                    );
                  },
                  (t) => e((t && t.error) || 'UndefinedError')
              );
          break;
        case 'Node.js':
          let a = require('iconv-lite');
          this.initGotEnv(t);
          const { url: r, ...i } = t;
          this.got[s](r, i).then(
              (t) => {
                const {
                      statusCode: s,
                      statusCode: r,
                      headers: i,
                      rawBody: o,
                    } = t,
                    n = a.decode(o, this.encoding);
                e(
                    null,
                    { status: s, statusCode: r, headers: i, rawBody: o, body: n },
                    n
                );
              },
              (t) => {
                const { message: s, response: r } = t;
                e(s, r, r && a.decode(r.rawBody, this.encoding));
              }
          );
      }
    }
    time(t, e = null) {
      const s = e ? new Date(e) : new Date();
      let a = {
        'M+': s.getMonth() + 1,
        'd+': s.getDate(),
        'H+': s.getHours(),
        'm+': s.getMinutes(),
        's+': s.getSeconds(),
        'q+': Math.floor((s.getMonth() + 3) / 3),
        S: s.getMilliseconds(),
      };
      /(y+)/.test(t) &&
      (t = t.replace(
          RegExp.$1,
          (s.getFullYear() + '').substr(4 - RegExp.$1.length)
      ));
      for (let e in a)
        new RegExp('(' + e + ')').test(t) &&
        (t = t.replace(
            RegExp.$1,
            1 == RegExp.$1.length
                ? a[e]
                : ('00' + a[e]).substr(('' + a[e]).length)
        ));
      return t;
    }
    queryStr(t) {
      let e = '';
      for (const s in t) {
        let a = t[s];
        null != a &&
        '' !== a &&
        ('object' == typeof a && (a = JSON.stringify(a)),
            (e += `${s}=${a}&`));
      }
      return (e = e.substring(0, e.length - 1)), e;
    }
    msg(e = t, s = '', a = '', r) {
      const i = (t) => {
        switch (typeof t) {
          case void 0:
            return t;
          case 'string':
            switch (this.getEnv()) {
              case 'Surge':
              case 'Stash':
              default:
                return { url: t };
              case 'Loon':
              case 'Shadowrocket':
                return t;
              case 'Quantumult X':
                return { 'open-url': t };
              case 'Node.js':
                return;
            }
          case 'object':
            switch (this.getEnv()) {
              case 'Surge':
              case 'Stash':
              case 'Shadowrocket':
              default: {
                let e = t.url || t.openUrl || t['open-url'];
                return { url: e };
              }
              case 'Loon': {
                let e = t.openUrl || t.url || t['open-url'],
                    s = t.mediaUrl || t['media-url'];
                return { openUrl: e, mediaUrl: s };
              }
              case 'Quantumult X': {
                let e = t['open-url'] || t.url || t.openUrl,
                    s = t['media-url'] || t.mediaUrl,
                    a = t['update-pasteboard'] || t.updatePasteboard;
                return {
                  'open-url': e,
                  'media-url': s,
                  'update-pasteboard': a,
                };
              }
              case 'Node.js':
                return;
            }
          default:
            return;
        }
      };
      if (!this.isMute)
        switch (this.getEnv()) {
          case 'Surge':
          case 'Loon':
          case 'Stash':
          case 'Shadowrocket':
          default:
            $notification.post(e, s, a, i(r));
            break;
          case 'Quantumult X':
            $notify(e, s, a, i(r));
            break;
          case 'Node.js':
        }
      if (!this.isMuteLog) {
        let t = ['', '==============📣系统通知📣=============='];
        t.push(e),
        s && t.push(s),
        a && t.push(a),
            console.log(t.join('\n')),
            (this.logs = this.logs.concat(t));
      }
    }
    log(...t) {
      t.length > 0 && (this.logs = [...this.logs, ...t]),
          console.log(t.join(this.logSeparator));
    }
    logErr(t, e) {
      switch (this.getEnv()) {
        case 'Surge':
        case 'Loon':
        case 'Stash':
        case 'Shadowrocket':
        case 'Quantumult X':
        default:
          this.log('', `❗️${this.name}, 错误!`, t);
          break;
        case 'Node.js':
          this.log('', `❗️${this.name}, 错误!`, t.stack);
      }
    }
    wait(t) {
      return new Promise((e) => setTimeout(e, t));
    }
    done(t = {}) {
      const e = new Date().getTime(),
          s = (e - this.startTime) / 1e3;
      switch (
          (this.log('', `🔔${this.name}, 结束! 🕛 ${s} 秒`),
              this.log(),
              this.getEnv())
          ) {
        case 'Surge':
        case 'Loon':
        case 'Stash':
        case 'Shadowrocket':
        case 'Quantumult X':
        default:
          $done(t);
          break;
        case 'Node.js':
          process.exit(1);
      }
    }
  })(t, e);
}
/*****************************************************************************/
