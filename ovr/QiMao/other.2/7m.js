/*
七猫小说
====================================
[rewrite_local]
^https?:\/\/(api-\w+|xiaoshuo)\.wtzw\.com\/api\/v\d\/ url script-response-body https://raw.githubusercontent.com/wf021325/qx/master/js/qimao.js

[mitm]
hostname = *.wtzw.com
====================================
 */

var body = $response.body;
var url = $request.url;

if (url.indexOf('/user/get-user-info') != -1) {
	body = body.replace(/\"is_vip\"\:\"\d\"/g， '"is_vip":"1"');
}

if (url.indexOf('/user/my-center') != -1) {
	body = body.replace(/\"year_vip_show\"\:\"\d\"/g， '"year_vip_show":"1"').replace(/\"vip_show_type\"\:\"\d+\"/g， '"vip_show_type":"40"').replace(/\"is_vip\"\:\"\d\"/g， '"is_vip":"1"');
	let obj = JSON.parse(body);
	delete obj.data.user_area.vip_info;
	obj.data.func_area = [{"type":"core_func"，"show_type":"1"，"list":[{"type":"my_read_history"，"first_title":"阅读历史"，"icon_url":"https://cdn.wtzw.com/bookimg/free/images/app/1_0_0/my-center/v3/mycenter_read_history.png"，"link_url":"freereader://reading_record"，"stat_code":"my_#_readhistory_click"，"red_point_show_type":"0"，"red_point_text":""，"number":"0"}，{"type":"must_read_ticket"，"first_title":"必读票"，"icon_url":"https://cdn.wtzw.com/bookimg/free/images/app/1_0_0/my-center/v3/mycenter_must_read_ticket.png"，"link_url":"freereader://bookstore_ticket_record"，"stat_code":"my_ticketrecord_#_click"，"red_point_show_type":"0"，"red_point_text":""，"number":"1"}，{"type":"book_friend"，"first_title":"书友圈"，"icon_url":"https://cdn.wtzw.com/bookimg/free/images/app/1_0_0/my-center/v3/mycenter_book_friend.png"，"link_url":"freereader://book_friend?param={\"type\":\"2\"，\"tab\":\"3\"}"，"stat_code":"my_bookfriends_none[action]"，"red_point_show_type":"0"，"red_point_text":""，"number":"0"}，{"type":"message"，"first_title":"消息通知"，"icon_url":"https://cdn.wtzw.com/bookimg/free/images/app/1_0_0/my-center/v3/mycenter_system_message.png"，"link_url":"freereader://message_notice?param={\"system_num\":\"0\"， \"reply_num\":\"0\"， \"like_num\":\"0\"}"，"stat_code":"my_#_message_click"，"red_point_show_type":"0"，"red_point_text":""，"number":"0"}]}，{"type":"other"，"show_type":"4"，"list":[{"type":"person_comment"，"stat_code":"my_mycomment_#_click"，"icon_url":"https://cdn.wtzw.com/bookimg/free/images/app/1_0_0/my-center/v3/mycenter_my_comment.png"，"link_url":"freereader://person_comment"，"first_title":"我的评论"，"red_point":"0"}，{"type":"read_preference"，"stat_code":"my_#_readlike_click"，"icon_url":"https://cdn.wtzw.com/bookimg/free/images/app/1_0_0/my-center/v3/mycenter_read_preferences.png"，"link_url":"freereader://reading_preference"，"first_title":"阅读喜好"，"red_point":"0"}，{"type":"feedback"，"stat_code":"my_helpfeedback_#_click"，"icon_url":"https://cdn.wtzw.com/bookimg/free/images/app/1_0_0/my-center/v3/mycenter_feedback.png"，"link_url":"freereader://help_feedback"，"first_title":"帮助与反馈"，"red_point":"0"}，{"type":"invite_friend"，"stat_code":"my_#_invitation_click"，"icon_url":"https://cdn.wtzw.com/bookimg/free/images/app/1_0_0/my-center/v3/mycenter_invite_friend.png"，"link_url":"freereader://invitation_invitefriend?param={\"url\":\"https://xiaoshuo.wtzw.com/app-h5/freebook/invite-friend\", \"type\":\"invite\"}","first_title":"邀请好友","red_point":"0"},{"type":"withdraw","stat_code":"my_coinwithdraw_#_click","icon_url":"https://cdn.wtzw.com/bookimg/free/images/app/1_0_0/my-center/usercenter_ico_gold.png","link_url":"freereader://webview?param={\"url\":\"https://xiaoshuo.wtzw.com/app-h5/freebook/web/withdraw?source=coin\"}","first_title":"金币提现","red_point":"0"},{"type":"become_author","stat_code":"my_#_author_click","icon_url":"https://cdn.wtzw.com/bookimg/free/images/app/1_0_0/my-center/v3/mycenter_become_author.png","link_url":"freereader://webview?param={\"url\":\"https://www.qimao.com/become_author.html\"}","first_title":"成为作家","red_point":"0"},{"type":"teenager_model","stat_code":"my_#_teenager_click","icon_url":"https://cdn.wtzw.com/bookimg/free/images/app/1_0_0/my-center/v3/mycenter_teenager_model.png","link_url":"freereader://teenager_model","first_title":"青少年模式","red_point":"0"},{"type":"setting","stat_code":"my_#_settings_click","icon_url":"https://cdn.wtzw.com/bookimg/free/images/app/1_0_0/my-center/v3/mycenter_setting.png","link_url":"freereader://settings","first_title":"设置","red_point":"0"}]}];
	body = JSON.stringify(obj);
	/* body = body.replace(/\"year_vip_show\"\:\"\d\"/g, '"year_vip_show":"1"').replace(/\"vip_show_type\"\:\"\d+\"/g, '"vip_show_type":"40"').replace(/\"is_vip\"\:\"\d\"/g, '"is_vip":"1"'); */
}

if (url.indexOf('/login/tourist') != -1) {
	body = body.replace(/\"is_vip\"\:\"\d\"/g， '"is_vip":"1"');
}

if (url.indexOf('/user/get-role-adv-vip-info') != -1) {
	body = body.replace(/\"year_vip_show\"\:\"\d\"/g， '"year_vip_show":"1"').replace(/\"isvip\"\:\"\d\"/g， '"isvip":"1"').replace(/\"isLifetimeVip\"\:\"\d\"/g， '"isLifetimeVip":"1"').replace(/\"type\"\:\"\d+\"/g， '"type":"40"');
}

if (url.indexOf('/bookshelf-adv/index') != -1) {
	body = body.replace(/\"list\"\:\[.*?\]/g， '"list":[]');
}

if (url.indexOf('/user/page') != -1) {
	body = body.replace(/\"year_vip_show\"\:\"\d\"/g， '"year_vip_show":"1"').replace(/\"is_vip\"\:\"\d\"/g， '"is_vip":"1"');
}

if (url.indexOf('/book/download') != -1) {
	body = body.replace(/\"list\"\:\[.*?\]/g， '"list":[]');
}

if (url.indexOf('/reader-adv/index') != -1) {
	body = body.replace(/\"reader_chapter_list\"\:\[.*?\]/g， '"reader_chapter_list":[]').replace(/\"reader_getcoin\"\:\[.*?\]/g， '"reader_getcoin":[]').replace(/\"reader_bottom_list\"\:\[.*?\]/g， '"reader_bottom_list":[]').replace(/\"reader_page_turn_list\"\:\[.*?\]/g， '"reader_page_turn_list":[]').replace(/\"reader_noad\"\:\[.*?\]/g， '"reader_noad":[]').replace(/\"reader_inchapter\"\:\[.*?\]/g， '"reader_inchapter":[]').replace(/\"feedback\"\:\[.*?\]/g， '"feedback":[]');
}

if (url.indexOf('/voice-adv/index') != -1) {
	body = body.replace(/\"voice_top\"\:\[.*?\]/g， '"voice_top":[]').replace(/\"voice_bottom\"\:\[.*?\]/g， '"voice_bottom":[]');
}

if (url.indexOf('/get-player-info') != -1) {
	body = body.replace(/\"voice_list\"\:\[.*?\]/g， '"voice_list":[]');
}

if (url.indexOf('/init-adv/index') != -1) {
	body = body.replace(/\"coopenHighList\"\:\[.*?\]/g， '"coopenHighList":[]');
}

if (url.indexOf('/bookshelf-adv/index') != -1) {
	body = body.replace(/\"bookshelf\"\:\[.*?\]/g， '"bookshelf":[]');
}

$done({body});
