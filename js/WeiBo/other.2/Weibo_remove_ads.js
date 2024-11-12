/*
寮曠敤鍦板潃锛歨ttps://raw.githubusercontent.com/RuCu6/Loon/main/Scripts/weibo.js
*/
// 2024-10-31 11:40

const url = $request.url;
if (!$response) $done({});
if (!$response.body) $done({});
let body = $response.body;

// 寰崥璇︽儏椤佃彍鍗曢厤缃�
const itemMenusConfig = {
  creatortypeask: false, // 杞彂浠诲姟
  mblog_menus_apeal: true, // 鐢宠瘔
  mblog_menus_avatar_widget: false, // 鐢ㄦ澶村儚鎸備欢
  mblog_menus_bullet_shield: true, // 灞忚斀寮瑰箷
  mblog_menus_card_bg: false, // 鐢ㄦ鍗＄墖鑳屾櫙
  mblog_menus_comment_manager: true, // 璇勮绠＄悊
  mblog_menus_copy_url: true, // 澶嶅埗閾炬帴
  mblog_menus_custom: false, // 瀵勫井鍗�
  mblog_menus_delete: true, // 鍒犻櫎
  mblog_menus_edit: true, // 缂栬緫
  mblog_menus_edit_history: true, // 缂栬緫璁板綍
  mblog_menus_edit_video: true, // 缂栬緫瑙嗛
  mblog_menus_favorite: true, // 鏀惰棌
  mblog_menus_follow: true, // 鍏虫敞
  mblog_menus_home: false, // 杩斿洖棣栭〉
  mblog_menus_long_picture: true, // 鐢熸垚闀垮浘
  mblog_menus_modify_visible: true, // 璁剧疆鍒嗕韩鑼冨洿
  mblog_menus_novelty: false, // 鏂伴矞浜嬫姇绋�
  mblog_menus_open_reward: false, // 璧炶祻
  mblog_menus_popularize: false,
  mblog_menus_promote: false, // 鎺ㄥ箍
  mblog_menus_report: true, // 鎶曡瘔
  mblog_menus_shield: true, // 灞忚斀
  mblog_menus_sticking: true, // 缃《
  mblog_menus_video_feedback: false, // 鎾斁鍙嶉
  mblog_menus_video_later: false // 鍙兘鏄◢鍚庡啀鐪�
};

if (url.includes("/interface/sdk/sdkad.php")) {
  // 寮€灞忓箍鍛�
  let obj = JSON.parse(body.substring(0, body.length - 2));
  if (obj?.needlocation) {
    obj.needlocation = false;
  }
  if (obj?.show_push_splash_ad) {
    obj.show_push_splash_ad = false;
  }
  if (obj?.background_delay_display_time) {
    obj.background_delay_display_time = 31536000; // 60 * 60 * 24 * 365 = 31536000
  }
  if (obj?.lastAdShow_delay_display_time) {
    obj.lastAdShow_delay_display_time = 31536000;
  }
  if (obj?.realtime_ad_video_stall_time) {
    obj.realtime_ad_video_stall_time = 0;
  }
  if (obj?.realtime_ad_timeout_duration) {
    obj.realtime_ad_timeout_duration = 0;
  }
  if (obj?.ads?.length > 0) {
    for (let item of obj.ads) {
      item.displaytime = 0;
      item.displayintervel = 31536000;
      item.allowdaydisplaynum = 0;
      item.begintime = "2040-01-01 00:00:00";
      item.endtime = "2040-01-01 23:59:59";
    }
  }
  $done({ body: JSON.stringify(obj) + "OK" });
} else {
  let obj = JSON.parse(body);
  if (url.includes("/2/cardlist")) {
    if (obj?.top) {
      delete obj.top; // 鍙戠幇椤� 瓒嬪娍 椤堕儴澶村浘
    }
    if (obj?.cards?.length > 0) {
      let newCards = [];
      for (let card of obj.cards) {
        if (card?.card_group?.length > 0) {
          let newGroup = [];
          for (let group of card.card_group) {
            let cardType = group.card_type;
            // 120,145 瑙嗛鐗堝潡杞挱鍥� 192妯増鐑棬瑙嗛 鐢靛奖 棰滃€� 鐢佃鍓х瓑
            if ([120, 145, 192]?.includes(cardType)) {
              continue;
            }
            // 鎴戠殑鐑悳 鏌ョ湅鏇村鐑悳
            if ([6, 101]?.includes(cardType)) {
              continue;
            }
            if (group?.mblog) {
              removeAvatar(group?.mblog); // 鍗＄墖鎸備欢,鍏虫敞鎸夐挳
            }
            newGroup.push(group);
          }
          card.card_group = newGroup;
          newCards.push(card);
        } else {
          let cardType = card.card_type;
          // 17鐚滀綘鎯虫悳 58鎼滅储鍋忓ソ璁剧疆
          if ([17, 58]?.includes(cardType)) {
            continue;
          }
          if (card?.mblog) {
            removeAvatar(card?.mblog); // 鍗＄墖鎸備欢,鍏虫敞鎸夐挳
          }
          newCards.push(card);
        }
      }
      obj.cards = newCards;
    }
  } else if (url.includes("/2/checkin/show")) {
    // 棣栭〉绛惧埌
    if (obj?.show) {
      obj.show = 0;
    }
    if (obj?.show_time) {
      obj.show_time = 0;
    }
  } else if (url.includes("/2/client/publisher_list")) {
    // 棣栭〉鍙充笂瑙掓寜閽�
    if (obj?.elements?.length > 0) {
      obj.elements = obj.elements.filter((i) => ["鍐欏井鍗�", "鍥剧墖", "瑙嗛"]?.includes(i?.app_name));
    }
  } else if (url.includes("/2/comments/build_comments")) {
    // 璇勮鍖�
    if (obj?.datas?.length > 0) {
      let newItems = [];
      for (let item of obj.datas) {
        if (item?.data) {
          if (!isAd(item?.data)) {
            if (item?.data?.comment_bubble) {
              delete item.data.comment_bubble; // 璇勮姘旀场
            }
            if (item?.data?.comment_bullet_screens_message) {
              delete item.data.comment_bullet_screens_message; // 璇勮寮瑰箷
            }
            if (item?.data?.hot_icon) {
              delete item.data.hot_icon; // 鐑瘎灏忓浘鏍� 寮瑰箷 棣栬瘎
            }
            if (item?.data?.vip_button) {
              delete item.data.vip_button; // 浼氬憳姘旀场鎸夐挳
            }
            // 寰崥浼璇勮
            if (item?.data?.user) {
              removeAvatar(item?.data); // 澶村儚鎸備欢,鍏虫敞鎸夐挳
              if (/(瓒呰瘽绀惧尯|寰崥)/.test(item?.data?.user?.name)) {
                continue;
              }
            }
            // 6涓轰綘鎺ㄨ崘鏇村绮惧僵鍐呭 15杩囨护鎻愮ず 41璇勮鍖烘皼鍥磋皟鏌�
            if ([6, 15, 41]?.includes(item?.type)) {
              continue;
            }
            if (["鎺ㄨ崘", "鐩稿叧鍐呭", "鐩稿叧璇勮"]?.includes(item?.adType)) {
              continue;
            }
            newItems.push(item);
          }
        }
      }
      obj.datas = newItems;
    } else if (obj?.root_comments?.length > 0) {
      let newItems = [];
      for (let item of obj.root_comments) {
        if (!isAd(item)) {
          if (item?.comment_bubble) {
            delete item.comment_bubble; // 璇勮姘旀场 鏂扮増鏈�
          }
          if (item?.data?.comment_bubble) {
            delete item.data.comment_bubble; // 璇勮姘旀场
          }
          if (item?.data?.comment_bullet_screens_message) {
            delete item.data.comment_bullet_screens_message; // 璇勮寮瑰箷
          }
          if (item?.data?.hot_icon) {
            delete item.data.hot_icon; // 鐑瘎灏忓浘鏍� 寮瑰箷 棣栬瘎
          }
          if (item?.data?.vip_button) {
            delete item.data.vip_button; // 浼氬憳姘旀场鎸夐挳
          }
          // 寰崥浼璇勮
          if (item.user) {
            removeAvatar(item); // 澶村儚鎸備欢,鍏虫敞鎸夐挳
            if (["瓒呰瘽绀惧尯", "寰崥瑙嗛"]?.includes(item?.user?.name)) {
              continue;
            }
          }
          newItems.push(item);
        }
      }
      obj.root_comments = newItems;
    } else if (obj?.comments?.length > 0) {
      let newItems = [];
      for (let item of obj.comments) {
        if (item?.reply_comment?.comment_badge) {
          delete item.reply_comment.comment_badge;
        }
        if (item?.user?.icons) {
          delete item.user.icons;
        }
        newItems.push(item);
      }
      obj.comments = newItems;
    }
    if (obj?.rootComment) {
      if (obj?.rootComment?.comment_bubble) {
        delete obj.rootComment.comment_bubble;
      }
    }
    if (obj?.status?.page_info) {
      removeVoteInfo(obj?.status); // 鎶曠エ绐楀彛
    }
  } else if (url.includes("/2/container/asyn")) {
    if (obj?.items?.length > 0) {
      let newItems = [];
      for (let item of obj.items) {
        removeAvatar(item?.data); // 鍏虫敞鎸夐挳
        if (/infeed_may_interest_in/.test(item?.itemId)) {
          // 浣犲彲鑳芥劅鍏磋叮鐨勮秴璇�
          continue;
        }
        if (item?.itemId === null) {
          // 妯増鍗氫富鍗＄墖
          continue;
        }
        if (item?.items?.length > 0) {
          for (let i of item.items) {
            removeAvatar(i?.data); // 鑳屾櫙鍗＄墖
            removeVoteInfo(i?.data); // 鎶曠エ绐楀彛
          }
        }
        newItems.push(item);
      }
      obj.items = newItems;
    }
  } else if (url.includes("/2/direct_messages/user_list")) {
    if (obj?.user_list?.length > 0) {
      obj.user_list = obj.user_list.filter((i) => !["娲诲姩閫氱煡", "闂亰"]?.includes(i?.user?.name));
    }
  } else if (url.includes("/2/flowlist")) {
    // 鍏虫敞鍒楄〃
    if (obj?.items?.length > 0) {
      for (let item of obj.items) {
        if (item?.items?.length > 0) {
          for (let i of item.items) {
            removeAvatar(i?.data); // 鑳屾櫙鍗＄墖
            removeVoteInfo(i?.data); // 鎶曠エ绐楀彛
          }
        }
      }
    }
    if (obj?.channelInfo?.channels?.length > 0) {
      let newTabs = [];
      for (let tab of obj.channelInfo.channels) {
        if (/_selfrecomm/.test(tab?.flowId)) {
          // 鍏虫敞椤垫帹鑽恡ab
          continue;
        } else if (/_chaohua/.test(tab?.flowId)) {
          // 鍏虫敞椤佃秴璇漷ab
          continue;
        } else {
          newTabs.push(tab);
        }
      }
      obj.channelInfo.channels = newTabs;
    }
  } else if (url.includes("/2/flowpage")) {
    // 鐑悳鍒楄〃
    if (obj?.items?.length > 0) {
      let newItems = [];
      for (let item of obj.items) {
        if (item?.data?.itemid === "hot-search-push-notice") {
          // 寮€鍚帹閫侀€氱煡鐨勬彁绀�
          continue;
        }
        if (item?.items?.length > 0) {
          let newII = [];
          for (let i of item.items) {
            if (i?.data.hasOwnProperty("promotion")) {
              // 鐑悳鍒楄〃涓殑鎺ㄥ箍椤圭洰
              continue;
            } else if (/_img_search_stick/.test(i?.data?.pic)) {
              // 鎵嬪姩缃《鐨勫井鍗氱儹鎼�
              continue;
            } else {
              newII.push(i);
            }
          }
          item.items = newII;
        }
        newItems.push(item);
      }
      obj.items = newItems;
    }
  } else if (url.includes("/2/groups/allgroups/v2")) {
    // 椤堕儴tab
    if (obj?.pageDatas?.length > 0) {
      // homeFeed鍏虫敞 homeHot鎺ㄨ崘
      let newTabs = [];
      for (let item of obj.pageDatas) {
        if (item?.pageDataType === "homeExtend") {
          // 澶氫綑鐨勬帹骞縯ab 姣斿鍗庝负Mate60
          continue;
        } else {
          if (item?.categories?.length > 0) {
            let newCates = [];
            for (let i of item.categories) {
              if (i?.title === "榛樿鍒嗙粍") {
                if (i?.pageDatas?.length > 0) {
                  let newII = [];
                  for (let ii of i.pageDatas) {
                    if (["鏈€鏂板井鍗�", "鐗瑰埆鍏虫敞", "濂藉弸鍦�", "瑙嗛"]?.includes(ii?.title)) {
                      // 鐧藉悕鍗曞垪琛�
                      newII.push(ii);
                    } else {
                      continue;
                    }
                    if (ii?.title === "鏈€鏂板井鍗�") {
                      ii.title = "寰崥";
                    }
                  }
                  i.pageDatas = newII;
                }
              }
              newCates.push(i);
            }
            item.categories = newCates;
          }
          newTabs.push(item);
        }
      }
      obj.pageDatas = newTabs;
    }
  } else if (url.includes("/2/messageflow/notice")) {
    // 娑堟伅鍔ㄦ€侀〉
    if (obj?.messages?.length > 0) {
      let newMsgs = [];
      for (let msg of obj.messages) {
        if (msg?.msg_card?.ad_tag) {
          continue;
        } else {
          newMsgs.push(msg);
        }
      }
      obj.messages = newMsgs;
    }
  } else if (url.includes("/2/page")) {
    // 鎼滅储椤靛垪琛�,瓒呰瘽
    if (obj?.cards?.length > 0) {
      if (obj?.cards?.[0]?.card_group?.length > 0) {
        obj.cards[0].card_group = obj.cards[0].card_group.filter(
          (c) => !(c?.actionlog?.ext?.includes("ads_word") || c?.itemid?.includes("t:51") || c?.itemid?.includes("ads_word"))
        );
      }
      obj.cards = obj.cards.filter(
        (i) =>
          !(
            i.itemid?.includes("feed_-_invite") || // 瓒呰瘽閲岀殑濂藉弸
            i.itemid?.includes("infeed_friends_recommend") || // 濂藉弸鍏虫敞
            i.itemid?.includes("infeed_may_interest_in") || // 浣犲彲鑳芥劅鍏磋叮鐨勮秴璇�
            i.itemid?.includes("infeed_pagemanual3") || // 鎵嬪姩鍖哄煙3
            i.itemid?.includes("infeed_weibo_mall") || // 寰崥灏忓簵
            i?.mblog?.mblogtypename?.includes("骞垮憡")
          )
      );
    } else if (obj?.card_group?.length > 0) {
      obj.card_group = obj.card_group.filter((i) => i?.desc?.includes("浣犲彲鑳芥劅鍏磋叮鐨勮秴璇�"));
    }
  } else if (url.includes("/2/profile/container_timeline")) {
    if (obj?.loadedInfo?.follow_guide_info) {
      delete obj.loadedInfo.follow_guide_info; // 涓汉涓婚〉鍏虫敞寮圭獥
    }
    // 涓汉涓婚〉淇℃伅娴�
    if (obj?.items?.length > 0) {
      let newItems = [];
      for (let item of obj.items) {
        if (item?.data?.left_hint?.[0]?.content === "鍏ㄩ儴寰崥(0)" && item?.data?.card_type === 216) {
          // 鍏ㄩ儴寰崥涓�0鐨勫崥涓�
          break;
        } else if (/鍐呭/.test(item?.data?.name) && item?.data?.card_type === 58) {
          // 涓汉寰崥椤靛埛瀹屽悗鐨勬帹鑽愬井鍗�
          break;
        } else {
          if (item?.category === "card") {
            // 58寰崥灞曠ず鏃堕棿娈垫彁绀� 216绛涢€夋寜閽�
            if ([58, 216]?.includes(item?.data?.card_type)) {
              if (/娌℃湁鍏紑鍗氭枃锛屼负浣犳帹鑽愪互涓嬬簿褰╁唴瀹�/.test(item?.data?.name)) {
                // 涓汉寰崥椤靛埛瀹屽悗鐨勬帹鑽愪俊鎭祦
                continue;
              }
            }
            newItems.push(item);
          } else if (item?.category === "group") {
            // 閬嶅巻group,淇濈暀缃《寰崥
            if (item?.header?.data?.icon) {
              delete item.header.data.icon; // 缃《寰崥鑳屾櫙鍥�
            }
            if (item?.itemId?.includes("INTEREST_PEOPLE")) {
              // 鍙兘鎰熷叴瓒ｇ殑浜�
              continue;
            }
            if (item?.profile_type_id === "weibo_cardpics") {
              // 杩戞湡鐑棬 绮鹃€夊井鍗� 閭ｅ勾浠婃棩绛夋í鐗堝唴瀹�
              continue;
            }
            if (item?.items?.length > 0) {
              let newII = [];
              for (let ii of item.items) {
                if (ii?.category === "feed") {
                  removeAvatar(ii?.data); // 澶村儚鎸備欢,鍏虫敞鎸夐挳
                  removeFeedAd(ii?.data); // 淇℃伅娴佹帹骞�
                  removeVoteInfo(ii?.data); // 鎶曠エ绐楀彛
                  // 璇勮鎸囧紩
                  if (ii?.data?.enable_comment_guide) {
                    ii.data.enable_comment_guide = false;
                  }
                  newII.push(ii);
                } else if (ii?.category === "card") {
                  if ([10, 48, 176]?.includes(ii?.data?.card_type)) {
                    // 鏈€杩戝叧娉ㄤ笌浜掑姩杩囩殑鍗氫富
                    continue;
                  }
                  if (ii?.data?.rightImage) {
                    delete ii.data.rightImage; // 鏂扮増缃《寰崥鐨囧啝
                  }
                  if (ii?.data?.backgroundImage) {
                    delete ii.data.backgroundImage; // 鏂扮増缃《寰崥鑳屾櫙鍥�
                  }
                  newII.push(ii);
                }
              }
              item.items = newII;
            }
            newItems.push(item);
          } else if (item?.category === "feed") {
            if (!isAd(item?.data)) {
              removeFeedAd(item?.data); // 淇℃伅娴佹帹骞�
              removeVoteInfo(item?.data); // 鎶曠エ绐楀彛
              if (item?.data?.source?.includes("鐢熸棩鍔ㄦ€�")) {
                // 绉婚櫎鐢熸棩绁濈寰崥
                continue;
              }
              if (item?.data?.title?.text !== "鐑棬" && item?.data?.title?.structs?.length > 0) {
                // 绉婚櫎璧炶繃鐨勫井鍗� 淇濈暀鐑棬鍐呭
                continue;
              }
              newItems.push(item);
            }
          }
        }
      }
      obj.items = newItems;
    }
  } else if (url.includes("/2/profile/dealatt") || url.includes("/2/friendships/")) {
    // 涓汉涓婚〉鐐瑰嚮鍏虫敞鍚庡睍绀鸿彍鍗�
    if (obj?.cards?.length > 0) {
      obj.cards = []; // 鐩稿叧鎺ㄨ崘鍗＄墖
    }
    if (obj?.toolbar_menus_new?.items?.length > 0) {
      let toolbar = obj.toolbar_menus_new;
      // 搴曢儴鑿滃崟
      let newTools = [];
      for (let item of toolbar.items) {
        if (item?.identifier === "recommend") {
          // 鐩稿叧鎺ㄨ崘
          continue;
        } else if (/reward_/.test(item?.identifier)) {
          // 璧炶祻
          continue;
        } else {
          newTools.push(item);
        }
      }
      toolbar.items = newTools;
    }
  } else if (url.includes("/2/profile/me")) {
    // 鎴戠殑椤甸潰
    if (obj?.vipHeaderBgImage) {
      delete obj.vipHeaderBgImage;
    }
    if (obj?.items?.length > 0) {
      let newItems = [];
      for (let item of obj.items) {
        let itemId = item.itemId;
        if (itemId === "profileme_mine") {
          if (item?.header) {
            if (item?.header?.vipView) {
              delete item.header.vipView;
            }
            if (item?.header?.vipCenter) {
              delete item.header.vipCenter;
            }
            if (item?.header?.vipIcon) {
              delete item.header.vipIcon;
            }
          }
          if (item?.items?.length > 0) {
            for (let d of item.items) {
              if (d.itemId === "mainnums_friends") {
                let s = d.click.modules[0].scheme;
                d.click.modules[0].scheme = s.replace("231093_-_selfrecomm", "231093_-_selffollowed");
              }
            }
          }
          newItems.push(item);
        } else if (itemId === "100505_-_top8") {
          if (item?.items?.length > 0) {
            item.items = item.items.filter(
              (i) =>
                i.itemId === "100505_-_album" || // 鎴戠殑鐩稿唽
                i.itemId === "100505_-_like" || // 璧�/鏀惰棌
                i.itemId === "100505_-_watchhistory" || // 娴忚璁板綍
                i.itemId === "100505_-_draft" // 鑽夌ǹ绠�
              // i.itemId === "100505_-_pay" || // 鎴戠殑閽卞寘
              // i.itemId === "100505_-_ordercenter" || // 鎴戠殑璁㈠崟
              // i.itemId === "100505_-_productcenter" || // 鍒涗綔涓績
              // i.itemId === "100505_-_promote" || // 骞垮憡涓績
            );
          }
          newItems.push(item);
        } else if (itemId === "100505_-_manage") {
          if (item?.style) {
            delete item.style;
          }
          if (item?.images) {
            delete item.images; // 绉婚櫎鍒嗛殧绗︾殑鐐圭偣鐐�
          }
          newItems.push(item);
        } else if (itemId === "100505_-_manage2") {
          if (item?.footer) {
            delete item.footer; // 绉婚櫎闈㈡澘鏍峰紡
          }
          if (item?.body) {
            delete item.body; // 绉婚櫎妗嗗唴鎺ㄥ箍
          }
          newItems.push(item);
        } else if (itemId === "100505_-_chaohua" || itemId === "100505_-_recentlyuser") {
          newItems.push(item);
        } else {
          // 绉婚櫎鍏朵粬鎺ㄥ箍
          continue;
        }
      }
      obj.items = newItems;
    }
  } else if (url.includes("/2/profile/statuses/tab")) {
    if (obj?.cards?.length > 0) {
      let newCards = [];
      for (let card of obj.cards) {
        if (card?.card_group?.length > 0) {
          let newGroup = [];
          for (let group of card.card_group) {
            let cardType = group.card_type;
            // 22閭ｅ勾浠婂ぉ
            if (cardType === 22) {
              continue;
            }
            if (group?.mblog) {
              removeAvatar(group?.mblog); // 鍗＄墖鎸備欢,鍏虫敞鎸夐挳
              removeVoteInfo(group?.mblog); // 鎶曠エ绐楀彛
            }
            newGroup.push(group);
          }
          card.card_group = newGroup;
          newCards.push(card);
        } else {
          if (card?.mblog) {
            removeAvatar(card?.mblog); // 鍗＄墖鎸備欢,鍏虫敞鎸夐挳
            removeVoteInfo(card?.mblog); // 鎶曠エ绐楀彛
          }
          newCards.push(card);
        }
      }
      obj.cards = newCards;
    }
    if (obj?.cardlistInfo?.page_type === "08") {
      delete obj.cardlistInfo; // 鎴戠殑鐑悳
    }
  } else if (url.includes("/2/profile/userinfo")) {
    // 涓汉璇︽儏椤�
    if (obj?.header?.data?.userInfo?.avatar_extend_info) {
      delete obj.header.data.userInfo.avatar_extend_info; // 澶村儚鎸備欢
    }
    if (obj?.profileSkin?.data) {
      delete obj.profileSkin.data; // 鍏ㄥ涓€х毊鑲�
    }
    if (obj?.footer?.data) {
      let toolbar = obj.footer.data.toolbar_menus_new;
      // 搴曢儴鑿滃崟椤圭洰
      if (toolbar?.lottie_guide) {
        delete toolbar.lottie_guide; // 寮圭獥
      }
      if (toolbar?.servicePopup?.subData) {
        delete toolbar.servicePopup.subData; // 鏈嶅姟鎮诞绐楀彛
      }
      if (toolbar?.items?.length > 0) {
        let newTools = [];
        for (let item of toolbar.items) {
          if (item?.identifier === "recommend") {
            // 鐩稿叧鎺ㄨ崘
            continue;
          } else if (item?.identifier === "urge") {
            // 鍌洿
            continue;
          } else if (/reward_/.test(item?.identifier)) {
            // 璧炶祻
            continue;
          } else {
            newTools.push(item);
          }
        }
        toolbar.items = newTools;
      }
    }
  } else if (url.includes("/2/push/active")) {
    if (obj?.compose_add_guide) {
      delete obj.compose_add_guide; // 杩囨湡鐨勬儏浜鸿妭绾㈠寘
    }
    // delete obj.feed_redpacket; // 棣栭〉鍙充笂瑙掔孩鍖呭浘鏍�
    if (obj?.floating_windows_force_show) {
      delete obj.floating_windows_force_show; // 寮哄埗灞曠ず鐨勬偓娴獥
    }
    if (obj?.interceptad) {
      delete obj.interceptad; // 鍙兘鏄椤电鍒板脊绐�
    }
    if (obj?.interceptad_cardlist) {
      delete obj.interceptad_cardlist; // 鍙兘鏄椤电鍒板脊绐�
    }
    if (obj?.loginconfig) {
      delete obj.loginconfig; // 鐧诲綍棰嗙孩鍖�
    }
    if (obj?.profile_lotties) {
      delete obj.profile_lotties; // 涓汉涓婚〉澶村儚鎸備欢绱犳潗
    }
    if (obj?.ug_red_paper) {
      delete obj.ug_red_paper; // 鍙兘鏄椤电鍒板脊绐�
    }
    if (obj?.weibo_pic_banner) {
      delete obj.weibo_pic_banner; // 寰崥绉嶈崏鏅掑浘
    }
    // 绂佺敤鎵€鏈夌殑鎮诞绐�
    if (obj?.disable_floating_window) {
      obj.disable_floating_window = "1";
    }
    // 棣栭〉鍙充笂瑙掔孩鍖呭浘鏍�
    if (obj?.feed_redpacket) {
      obj.feed_redpacket.starttime = "2208960000";
      obj.feed_redpacket.interval = "31536000";
      obj.feed_redpacket.endtime = "2209046399";
      if (obj?.feed_redpacket?.finish_icon) {
        delete obj.feed_redpacket.finish_icon;
      }
      if (obj?.feed_redpacket?.guide) {
        delete obj.feed_redpacket.guide;
      }
      if (obj?.feed_redpacket?.icon) {
        delete obj.feed_redpacket.icon;
      }
      if (obj?.feed_redpacket?.pre_icon) {
        delete obj.feed_redpacket.pre_icon;
      }
    }
    if (obj?.floating_window_for_live_streaming) {
      obj.floating_window_for_live_streaming = false;
    }
    if (obj?.floating_window_show_interval) {
      obj.floating_window_show_interval = 31536000;
    }
    if (obj?.floating_windows?.length > 0) {
      obj.floating_windows = obj.floating_windows.filter((i) => !/(?:^ad_?|red_pocket|ug_high_priority)/.test(i?.subtype));
    }
  } else if (url.includes("/2/search/")) {
    // 鎼滅储椤典俊鎭祦
    if (url.includes("container_timeline")) {
      if (obj?.loadedInfo) {
        delete obj.loadedInfo;
      }
      if (obj?.items?.length > 0) {
        let newItems = [];
        for (let item of obj.items) {
          if (item?.category === "feed") {
            if (!isAd(item?.data)) {
              removeFeedAd(item?.data); // 淇℃伅娴佹帹骞�
              newItems.push(item);
            }
          } else if (item?.category === "card") {
            // 19鐑绛塼ab 22鍟嗕笟鎺ㄥ箍 118妯増骞垮憡鍥剧墖 206,249妯増瑙嗛骞垮憡 208瀹炲喌鐑亰 217閿欒繃浜嗙儹璇� 236寰崥瓒嬪娍 261濂ヨ繍婊氬姩妯箙
            if ([19, 22, 118, 206, 208, 217, 236, 249, 261]?.includes(item?.data?.card_type)) {
              continue;
            } else if (item?.data?.card_type === 86 && item?.data?.itemid === "ads_slide") {
              // 鍟嗕笟鎺ㄥ箍 涓诲浘 闄勫浘
              continue;
            } else if (item?.data?.card_type === 101 && item?.data?.cate_id === "1114") {
              // 寰崥瓒嬪娍鏍囬
              continue;
            } else if (item?.data?.card_type === 196 && item?.data.hasOwnProperty("rank")) {
              // 濂ヨ繍绛夋帓琛屾
              continue;
            } else {
              newItems.push(item);
            }
          } else if (item?.category === "cell") {
            // 淇濈暀淇℃伅娴佸垎鍓茬嚎
            newItems.push(item);
          } else if (item?.category === "group") {
            if (item?.items?.length > 0) {
              let newII = [];
              for (let ii of item.items) {
                // 118妯増骞垮憡鍥剧墖 182鐑璇濋 217閿欒繃浜嗙儹璇� 247妯増瑙嗛骞垮憡
                if ([118, 182, 217, 247]?.includes(ii?.data?.card_type)) {
                  continue;
                } else {
                  newII.push(ii);
                }
              }
              item.items = newII;
            }
            newItems.push(item);
          }
        }
        obj.items = newItems;
      }
    } else if (url.includes("finder")) {
      if (obj?.channelInfo?.channels?.length > 0) {
        let newChannels = [];
        for (let channel of obj.channelInfo.channels) {
          // 椤堕儴鏍囩鏍� 鐧藉悕鍗�
          if (["band_channel", "discover_channel", "trends_channel"]?.includes(channel?.key)) {
            let payload = channel.payload;
            if (payload) {
              if (payload?.loadedInfo) {
                // 鍘婚櫎鎼滅储妗嗗～鍏呰瘝
                if (payload?.loadedInfo?.searchBarContent?.length > 0) {
                  payload.loadedInfo.searchBarContent = [];
                }
                if (payload?.loadedInfo?.headerBack?.channelStyleMap) {
                  delete payload.loadedInfo.headerBack.channelStyleMap; // 鍘婚櫎鎼滅储鑳屾櫙鍥剧墖
                }
                if (payload?.loadedInfo?.searchBarStyleInfo) {
                  delete payload.loadedInfo.searchBarStyleInfo; // 鎼滅储妗嗘牱寮�
                }
              }
              if (payload?.items?.length > 0) {
                let newItems = [];
                for (let item of payload.items) {
                  if (item?.category === "feed") {
                    if (!isAd(item?.data)) {
                      removeFeedAd(item.data); // 淇℃伅娴佹帹骞�
                      newItems.push(item);
                    }
                  } else if (item?.category === "card") {
                    // 19鐑绛塼ab 22鍟嗕笟鎺ㄥ箍 118妯増骞垮憡鍥剧墖 206,249妯増瑙嗛骞垮憡 208瀹炲喌鐑亰 217閿欒繃浜嗙儹璇� 236寰崥瓒嬪娍 261濂ヨ繍婊氬姩妯箙
                    if ([19, 22, 118, 206, 208, 217, 236, 249, 261]?.includes(item?.data?.card_type)) {
                      continue;
                    } else if (item?.data?.card_type === 86 && item?.data?.itemid === "ads_slide") {
                      // 鍟嗕笟鎺ㄥ箍 涓诲浘 闄勫浘
                      continue;
                    } else if (item?.data?.card_type === 101 && item?.data?.cate_id === "1114") {
                      // 寰崥瓒嬪娍鏍囬
                      continue;
                    } else if (item?.data?.card_type === 196 && item?.data.hasOwnProperty("rank")) {
                      // 濂ヨ繍绛夋帓琛屾
                      continue;
                    } else {
                      newItems.push(item);
                    }
                  } else if (item?.category === "cell") {
                    // 淇濈暀淇℃伅娴佸垎鍓茬嚎
                    newItems.push(item);
                  } else if (item?.category === "group") {
                    if (item?.items?.length > 0) {
                      let newII = [];
                      for (let ii of item.items) {
                        // 118妯増骞垮憡鍥剧墖 182鐑璇濋 192妯増濂界湅瑙嗛 217閿欒繃浜嗙儹璇� 247妯増瑙嗛骞垮憡
                        if ([118, 182, 192, 217, 247]?.includes(ii?.data?.card_type)) {
                          continue;
                        } else {
                          newII.push(ii);
                        }
                      }
                      item.items = newII;
                    }
                    newItems.push(item);
                  }
                }
                payload.items = newItems;
              }
            }
            newChannels.push(channel);
          } else {
            continue;
          }
        }
        obj.channelInfo.channels = newChannels;
      }
    }
  } else if (url.includes("/2/searchall")) {
    if (obj?.header?.data) {
      // 鍟嗗搧鎺ㄥ箍澶撮儴娣樺疂璺宠浆
      const items = ["bg_img", "background_scheme", "background_url"];
      for (let i of items) {
        delete obj.header.data[i];
      }
    }
    if (obj?.loadedInfo?.serviceMap?.layer) {
      delete obj.loadedInfo.serviceMap.layer; // 鎼滅储缁撴灉 鎮诞绐�
    }
    if (obj?.footer) {
      // 璁ㄨ鍖哄姩鐢�
      if (obj?.footer?.data?.bg_lottie) {
        delete obj.footer.data.bg_lottie;
      }
      if (obj?.footer?.data?.bg_lottie_dark) {
        delete obj.footer.data.bg_lottie_dark;
      }
      if (obj?.footer?.data?.discuss_avatars) {
        delete obj.footer.data.discuss_avatars; // 杩涘叆璁ㄨ鍖烘皵娉″姩鐢诲ご鍍�
      }
      if (obj?.footer?.data?.menus?.length > 0) {
        // 搴曢儴鑿滃崟
        obj.footer.data.menus = obj.footer.data.menus.filter((i) => !/\d+_ai\./.test(i?.pic));
      }
    }
    if (obj?.cards?.length > 0) {
      let newCards = [];
      for (let card of obj.cards) {
        if (card?.card_group?.length > 0) {
          let newGroup = [];
          for (let group of card.card_group) {
            if (group?.card_type === 22) {
              // 鍏堢瓫閫塩ard_group閲岄潰鐨刢ard_type
              // 妯増骞垮憡鍥�
              continue;
            } else if (group?.card_type === 42 && group?.title_extra_text === "骞垮憡") {
              // 鎺ㄨ崘鍝佺墝骞垮憡
              continue;
            } else if (group?.card_type === 3 && group?.pics?.length > 0) {
              // 鎺ㄨ崘鍝佺墝骞垮憡鍥�
              continue;
            } else {
              if (group?.mblog) {
                // 鏈塵blog瀛楁鐨勮繃婊ゅ箍鍛�
                if (!isAd(group?.mblog)) {
                  if (group?.mblog?.title_source) {
                    delete group.mblog.title_source;
                  }
                  if (group?.mblog?.source_tag_struct) {
                    delete group.mblog.source_tag_struct;
                  }
                  if (group?.mblog?.extend_info) {
                    delete group.mblog.extend_info;
                  }
                  if (group?.mblog?.common_struct) {
                    delete group.mblog.common_struct; // 鍟嗗搧姗辩獥
                  }
                  removeAvatar(group?.mblog); // 澶村儚鎸備欢,鍏虫敞鎸夐挳
                  removeVoteInfo(group?.mblog); // 鎶曠エ绐楀彛
                  // 鏂扮増鐑帹
                  if (group?.mblog?.is_ad === 1) {
                    continue;
                  }
                  newGroup.push(group);
                }
              } else {
                newGroup.push(group); // 娌℃湁mblog瀛楁鐨勫叏閮ㄦ帹閫�
              }
            }
          }
          card.card_group = newGroup;
          newCards.push(card);
        } else {
          if (card?.mblog) {
            if (!isAd(card?.mblog)) {
              removeAvatar(card?.mblog); // 澶村儚鎸備欢,鍏虫敞鎸夐挳
              if (card?.mblog?.title_source) {
                delete card.mblog.title_source;
              }
              if (card?.mblog?.source_tag_struct) {
                delete card.mblog.source_tag_struct;
              }
              if (card?.mblog?.extend_info) {
                delete card.mblog.extend_info;
              }
              if (card?.mblog?.common_struct) {
                delete card.mblog.common_struct; // 鍟嗗搧姗辩獥
              }
              removeVoteInfo(card?.mblog); // 鎶曠エ绐楀彛
              // 闅愯棌鍦� cards 閲岄潰鐨勬姇绁ㄧ獥鍙�
              if (card?.mblog?.page_info?.cards?.length > 0) {
                let page = card.mblog.page_info;
                for (let i of page.cards) {
                  if (i?.media_info?.vote_info) {
                    delete i.media_info.vote_info;
                  }
                }
              }
              newCards.push(card);
            }
          }
        }
      }
      obj.cards = newCards;
    }
    // 13.11.1鐗堟湰obj涓嬬殑cards鍙樹负浜唅tems 2023-11-26
    if (obj?.items?.length > 0) {
      let newItems = [];
      for (let item of obj.items) {
        if (!isAd(item?.data)) {
          if (item?.category === "feed") {
            removeFeedAd(item?.data); // 淇℃伅娴佹帹骞�
            removeVoteInfo(item?.data); // 鎶曠エ绐楀彛
            newItems.push(item);
          } else if (item?.category === "group") {
            if (item?.items?.length > 0) {
              let newII = [];
              for (let ii of item.items) {
                if (ii?.cate_id === "638" && ii?.readtimetype === "card") {
                  // 澶у閮藉湪闂�
                  continue;
                } else {
                  if (!isAd(ii?.data)) {
                    removeAvatar(ii?.data);
                    removeFeedAd(ii?.data); // 鍟嗗搧姗辩獥
                    // 3鎺ㄥ箍鍗＄墖 17鐩稿叧鎼滅储 22骞垮憡鍥� 25鏅烘悳鎬荤粨 30鎺ㄨ崘鍗氫富 42,236鏅烘悳闂瓟 89鍟嗗搧鎺ㄥ箍瑙嗛 101澶у閮藉湪闂� 206鎺ㄥ箍瑙嗛
                    if ([3, 17, 22, 30, 42, 89, 101, 206]?.includes(ii?.data?.card_type)) {
                      continue;
                    } else if (ii?.data?.card_type === 4 && ii?.data?.cate_id === "640") {
                      // 澶у閮藉湪闂�
                      continue;
                    } else if (ii?.data?.card_type === 42 && ii?.data?.is_ads === true) {
                      // 鍟嗗搧鎺ㄥ箍desc
                      continue;
                    }
                    newII.push(ii);
                  }
                }
              }
              item.items = newII;
            }
            newItems.push(item);
          } else {
            newItems.push(item);
          }
        }
      }
      obj.items = newItems;
    }
  } else if (url.includes("/2/shproxy/chaohua/discovery/searchactive")) {
    // 瓒呰瘽鎼滅储椤�
    if (obj?.items?.length > 0) {
      // 1007 鍙兘鎰熷叴瓒ｇ殑璇濋
      obj.items = obj.items.filter((i) => i?.data?.card_type !== 1007);
    }
  } else if (url.includes("/2/statuses/container_timeline_hot") || url.includes("/2/statuses/unread_hot_timeline")) {
    // 棣栭〉鎺ㄨ崘tab淇℃伅娴�
    for (let s of ["ad", "advertises", "trends", "headers"]) {
      if (obj?.[s]) {
        delete obj[s];
      }
    }
    if (obj?.items?.length > 0) {
      let newItems = [];
      for (let item of obj.items) {
        if (!isAd(item?.data)) {
          if (item?.category === "feed") {
            removeFeedAd(item?.data); // 淇℃伅娴佹帹骞�
            removeVoteInfo(item?.data); // 鎶曠エ绐楀彛
            newItems.push(item);
          } else {
            // 绉婚櫎鍏朵粬鎺ㄥ箍
            continue;
          }
        }
      }
      obj.items = newItems;
    }
    if (obj?.statuses?.length > 0) {
      let newStatuses = [];
      for (let item of obj.statuses) {
        if (!isAd(item)) {
          removeFeedAd(item); // 淇℃伅娴佹帹骞�
          newStatuses.push(item);
        }
      }
      obj.statuses = newStatuses;
    }
  } else if (url.includes("/2/statuses/container_timeline?") || url.includes("/2/statuses/container_timeline_unread")) {
    if (obj?.loadedInfo?.headers) {
      delete obj.loadedInfo.headers; // 棣栭〉鍏虫敞tab淇℃伅娴�
    }
    if (obj?.common_struct) {
      delete obj.common_struct; // 鍟嗗搧姗辩獥
    }
    if (obj?.items?.length > 0) {
      let newItems = [];
      for (let item of obj.items) {
        if (!isAd(item?.data)) {
          if (item?.category === "feed") {
            if (item?.data?.action_button_icon_dic) {
              delete item.data.action_button_icon_dic;
            }
            removeFeedAd(item?.data); // 淇℃伅娴佹帹骞�
            removeVoteInfo(item?.data); // 鎶曠エ绐楀彛
            if (item.data?.title?.structs) {
              // 绉婚櫎 鏈叧娉ㄤ汉娑堟伅 (浣犲叧娉ㄧ殑鍗氫富锛屼粬鑷繁鍏虫敞鐨勫埆鐨勫崥涓荤殑寰崥娑堟伅)
              continue;
            }
            // 蹇浆鍐呭
            if (item?.data?.screen_name_suffix_new?.length > 0) {
              if (item?.data?.screen_name_suffix_new?.[3]?.content === "蹇浆浜�") {
                continue;
              }
            }
            // 缇庡绮鹃€夊
            if (item?.data?.title?.text?.includes("绮鹃€�")) {
              continue;
            }
            // 鏈叧娉ㄥ崥涓�
            if (item?.data?.user?.following === false) {
              continue;
            }
            // 鍏抽棴鍏虫敞鎺ㄨ崘
            if (item?.data?.user?.unfollowing_recom_switch === 1) {
              item.data.user.unfollowing_recom_switch = 0;
            }
            // 鍗氫富top100
            if (item?.data?.tag_struct?.length > 0) {
              item.data.tag_struct = [];
            }
            newItems.push(item);
          } else if (item?.category === "feedBiz") {
            newItems.push(item); // 绠＄悊鐗瑰埆鍏虫敞鎸夐挳
          } else {
            // 绉婚櫎鍏朵粬鎺ㄥ箍
            continue;
          }
        }
      }
      obj.items = newItems;
    }
  } else if (url.includes("/2/statuses/container_timeline_topic")) {
    // 瓒呰瘽淇℃伅娴�
    if (obj?.header?.data?.follow_guide_info) {
      delete obj.header.data.follow_guide_info; // 搴曢儴寮瑰嚭鐨勫叧娉ㄦ寜閽�
    }
    if (obj?.items?.length > 0) {
      let newItems = [];
      for (let item of obj.items) {
        if (item?.category === "feed") {
          removeAvatar(item?.data); // 澶村儚鎸備欢,鍏虫敞鎸夐挳
          if (!isAd(item?.data)) {
            if (item?.data?.title?.text?.includes("鏂颁汉瀵煎笀")) {
              // 钀屾柊甯� 浜掑姩璧㈡柊浜哄甯�
              delete item.data.title;
            }
            newItems.push(item);
          }
        } else if (item?.category === "card") {
          if ([4, 197, 1012]?.includes(item?.data?.card_type)) {
            // 4 浣犲彲鑳芥劅鍏磋叮鐨勮秴璇�
            // 197 浣犲彲鑳芥劅鍏磋叮鐨勮秴璇�
            // 1012 鐑棬瓒呰瘽
            continue;
          } else {
            if (item?.data?.card_type === 31 && item?.data?.hotwords?.length > 0) {
              // 31 鎼滅储妗嗘粴鍔ㄧ儹璇�
              item.data.hotwords = [];
            }
            newItems.push(item);
          }
        } else if (item?.category === "group") {
          if (item?.style?.topHover) {
            delete item.style.topHover; // 绌洪檷鍙戝笘鑳屾櫙鍥�
          }
          if (item?.items?.length > 0) {
            if (item?.itemId === null) {
              // 瓒呰瘽椤甸《閮ㄤ贡涓冨叓绯�
              let newII = [];
              for (let ii of item.items) {
                if (ii?.data.hasOwnProperty("itemid")) {
                  if (ii?.data?.itemid?.includes("mine_topics")) {
                    // 淇濈暀鎴戠殑瓒呰瘽
                    newII.push(ii);
                  } else if (ii?.data?.itemid?.includes("tab_search_input")) {
                    // 淇濈暀鎼滅储妗�
                    if (ii?.data?.hotwords) {
                      ii.data.hotwords = [{ word: "鎼滅储瓒呰瘽" }]; // 鍒犻櫎鐑悳璇�
                    }
                    newII.push(ii);
                  } else if (ii?.data?.itemid?.includes("poiRankList")) {
                    newII.push(ii); // 淇濈暀鍦扮偣瓒呰瘽 鍦版爣浜烘皵姒�
                  }
                } else {
                  newII.push(ii); // 鏀捐鏃爄temid瀛楁鐨勫唴瀹�
                }
                removeAvatar(ii?.data); // 澶村儚鎸備欢,鍏虫敞鎸夐挳
              }
              item.items = newII;
            } else {
              let newII = [];
              for (let ii of item.items) {
                if (ii?.data) {
                  if (ii?.data?.common_struct) {
                    delete ii.data.common_struct;
                  }
                  removeAvatar(ii?.data);
                  if ([1008, 1024]?.includes(ii?.data?.card_type)) {
                    // 1008鍏虫敞浣犳劅鍏磋叮鐨勮秴璇� 1024瓒呰瘽椤堕儴鍙戠幇
                    continue;
                  } else {
                    newII.push(ii);
                  }
                }
              }
              item.items = newII;
            }
          }
          if (item?.header?.arrayText?.contents?.length > 0) {
            // 浣犵殑濂藉弸涔熷叧娉ㄤ簡
            continue;
          }
          newItems.push(item);
        } else {
          // 绉婚櫎鍏朵粬鎺ㄥ箍
          continue;
        }
      }
      obj.items = newItems;
    }
  } else if (url.includes("/2/statuses/extend")) {
    // 寰崥璇︽儏椤�
    if (obj?.trend?.extra_struct?.extBtnInfo?.btn_picurl?.includes("ad")) {
      delete obj.trend;
    }
    if (obj.trend?.titles) {
      let title = obj.trend.titles.title;
      if (/(鍗氫富濂界墿绉嶈崏|鐩稿叧鎺ㄨ崘|涓撳尯)/.test(title)) {
        delete obj.trend;
      }
    }
    const item = [
      "bubble_guide_data", // 璇勮鍖哄脊绐�
      "button_extra_info", // 鎺ㄨ崘璇勮
      "display_info", // 浜屾ゼ
      "extend_info", // 鎷撳睍鍗＄墖
      "floating_button", // 鎮诞璐墿杞︽寜閽�
      "follow_data", // 鍏虫敞鎻愰啋
      "head_cards", // 瓒呰瘽鎶曠エ
      "highlight", // 浜屾ゼ
      "interaction_extra_info", // ai璇勮
      "page_alerts", // 瓒呰瘽鏂板笘 鏂扮敤鎴烽€氱煡
      "reward_info", // 鍏泭璧炶祻
      "source_tag_struct", // 浜屾ゼ
      "top_cards" // 澶у閮藉湪鎼�
    ];
    if (obj) {
      item.forEach((i) => {
        delete obj[i];
      });
    }
    if (obj?.custom_action_list?.length > 0) {
      let newActions = [];
      for (let item of obj.custom_action_list) {
        let type = item.type;
        let add = itemMenusConfig[type];
        if (type === "mblog_menus_copy_url") {
          newActions.unshift(item);
        } else if (add) {
          newActions.push(item);
        }
      }
      obj.custom_action_list = newActions;
    }
    if (obj?.has_common_struct) {
      obj.has_common_struct = false; // 鍟嗗搧姗辩獥
    }
    if (obj?.enable_comment_guide) {
      obj.enable_comment_guide = false; // 璇勮鎸囧紩
    }
  } else if (url.includes("/2/statuses/repost_timeline")) {
    // 璇勮璇︽儏椤� 杞彂鍖�
    if (obj?.hot_reposts?.length > 0) {
      // 鏍峰紡1
      let newReposts = [];
      for (let item of obj.hot_reposts) {
        if (!isAd(item)) {
          newReposts.push(item);
        }
      }
      obj.hot_reposts = newReposts;
    }
    if (obj?.reposts?.length > 0) {
      // 鏍峰紡2
      let newReposts = [];
      for (let item of obj.reposts) {
        if (!isAd(item)) {
          newReposts.push(item);
        }
      }
      obj.reposts = newReposts;
    }
  } else if (url.includes("/2/statuses/show")) {
    removeFeedAd(obj); // 淇℃伅娴佹帹骞�
    // 寰幆寮曠敤涓殑鍟嗗搧姗辩獥
    if (obj?.text) {
      removeFeedAd(obj.text); // 淇℃伅娴佹帹骞�
    }
    if (obj?.reward_info) {
      delete obj.reward_info; // 璧炶祻淇℃伅
    }
    // 鎶曠エ绐楀彛
    removeVoteInfo(obj);
  } else if (url.includes("/2/video/tiny_stream_video_list")) {
    if (obj?.statuses?.length > 0) {
      obj.statuses = []; // 绉婚櫎瑙嗛鑷姩杩炴挱
      // obj.statuses = obj.statuses.filter((m) => !(m.mblogtypename === "骞垮憡"));
    }
    if (obj?.tab_list?.length > 0) {
      obj.tab_list = [];
    }
  } else if (url.includes("/2/!/huati/discovery_home_bottom_channels")) {
    if (obj?.button_configs) {
      delete obj.button_configs; // 瓒呰瘽宸︿笂瑙�,鍙充笂瑙掑浘鏍�
    }
    // 骞垮満椤�
    if (obj?.channelInfo?.channel_list?.length > 0) {
      obj.channelInfo.channel_list = obj.channelInfo.channel_list.filter((t) => t.title !== "骞垮満");
    }
  } else if (url.includes("/aj/appicon/list")) {
    if (obj?.data?.list?.length > 0) {
      for (let item of obj.data.list) {
        if (item?.cardType) {
          item.cardType = 2;
        }
      }
    }
  } else if (url.includes("/v1/ad/preload") || url.includes("/v2/ad/preload")) {
    // 寮€灞忓箍鍛�
    if (obj?.ads?.length > 0) {
      for (let item of obj.ads) {
        item.start_time = 3818332800; // Unix 鏃堕棿鎴� 2090-12-31 00:00:00
        item.end_time = 3818419199; // Unix 鏃堕棿鎴� 2090-12-31 23:59:59
        item.daily_display_cnt = 50; // total_display_cnt: 50
        item.display_duration = 0;
      }
      if (obj?.ads?.creatives?.length > 0) {
        for (let item of obj.ads.creatives) {
          item.start_time = 3818332800; // Unix 鏃堕棿鎴� 2090-12-31 00:00:00
          item.end_time = 3818419199; // Unix 鏃堕棿鎴� 2090-12-31 23:59:59
          item.daily_display_cnt = 50; // total_display_cnt: 50
          item.display_duration = 0;
        }
      }
    }
  } else if (url.includes("/wbapplua/wbpullad.lua") || url.includes("/preload/get_ad")) {
    // 寮€灞忓箍鍛�
    if (obj?.cached_ad?.ads?.length > 0) {
      for (let item of obj.cached_ad.ads) {
        item.show_count = 50;
        item.duration = 0; // 60 * 60 * 24 * 365 = 31536000
        item.start_date = 3818332800; // Unix 鏃堕棿鎴� 2090-12-31 00:00:00
        item.end_date = 3818419199; // Unix 鏃堕棿鎴� 2090-12-31 23:59:59
      }
    }
  }
  $done({ body: JSON.stringify(obj) });
}

// 鍒ゆ柇淇℃伅娴�
function isAd(data) {
  if (data?.mblogtypename === "骞垮憡") {
    return true;
  }
  if (data?.mblogtypename === "鐑帹") {
    return true;
  }
  if (data?.promotion?.recommend === "骞垮憡") {
    return true;
  }
  if (data?.promotion?.recommend === "鐑帹") {
    return true;
  }
  if (data?.promotion?.type?.includes("ad")) {
    return true;
  }
  if (data?.content_auth_info?.content_auth_title === "骞垮憡") {
    return true;
  }
  if (data?.content_auth_info?.content_auth_title === "鐑帹") {
    return true;
  }
  if (data?.ads_material_info?.is_ads === true) {
    return true;
  }
  return false;
}

// 绉婚櫎澶村儚鎸備欢,鍏虫敞鎸夐挳
function removeAvatar(data) {
  if (data?.block_card_bg) {
    delete data.block_card_bg;
  }
  if (data?.buttons) {
    delete data.buttons;
  }
  if (data?.cardid) {
    delete data.cardid;
  }
  if (data?.icons) {
    delete data.icons;
  }
  if (data?.mblog_buttons) {
    delete data.mblog_buttons; // 杞彂鎸夐挳鍥炬爣
  }
  if (data?.pic_bg_new) {
    delete data.pic_bg_new;
  }
  if (data?.user?.avatargj_id) {
    delete data.user.avatargj_id;
  }
  if (data?.user?.avatar_extend_info) {
    delete data.user.avatar_extend_info;
  }
  if (data?.user?.cardid) {
    delete data.user.cardid;
  }
  if (data?.user?.icons) {
    delete data.user.icons;
  }
  if (data?.user?.mbtype) {
    delete data.user.mbtype; // 浼氬憳绛夌骇鍥炬爣
  }
}

// 绉婚櫎淇℃伅娴佸叧娉ㄦ寜閽�,鎺ㄥ箍,鐑瘎
function removeFeedAd(item) {
  removeAvatar(item); // 澶村儚鎸備欢,鍏虫敞鎸夐挳
  if (item?.retweeted_status) {
    removeAvatar(item?.retweeted_status);
  }
  if (item?.common_struct) {
    delete item.common_struct; // 鍟嗗搧姗辩獥
  }
  if (item?.comment_summary) {
    delete item.comment_summary; // 绉婚櫎淇℃伅娴佷腑鐨勭儹璇�
  }
  if (item?.semantic_brand_params) {
    delete item.semantic_brand_params; // 鍟嗗搧姗辩獥
  }
}

// 绉婚櫎鎶曠エ绐楀彛
function removeVoteInfo(item) {
  if (item?.page_info?.media_info?.vote_info) {
    delete item.page_info.media_info.vote_info;
  }
}
