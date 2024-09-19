/*************************************
[rewrite_local]
^https:\/\/dj\.palmestore\.com\/zyuc\/api\/user\/accountInfo url script-response-body https://raw.githubusercontent.com/mikoycc/surge/main/module/djxs/djxs.js

[mitm]
hostname = dj.palmestore.com
*************************************/

var chxm1023 = JSON.parse($response.body);

chxm1023.body.userInfo.unlockVipInfo = {
        "vipType" : 1,
        "vipExpire" : 4092599349,
        "expireDate" : "2099-09-09"
      };
chxm1023.body.userInfo.vipInfo = {
        "content" : "点击进入购买会员",
        "vipType" : 1,
        "expireDate" : "2099-09-09",
        "halfScreen" : "https://dj.palmestore.com/zytc/public/index.php?ca=FreeVip.Index&source=book",
        "expireDateNew" : "2099-09-09",
        "description" : "开通会员",
        "fullScreen" : "https://dj.palmestore.com/zytc/public/index.php?ca=FreeVip.Index&showContentInStatusBar=1&source=mine",
        "vipExpire" : 4092599349};

$done({body : JSON.stringify(chxm1023)});
