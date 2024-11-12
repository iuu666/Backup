// 2024-09-08 12:03:12
const url = $request.url;
if (!$response.body) $done({});
let obj = JSON.parse($response.body);

if (url.includes("/personalCenter/list")) {
    // 澶勭悊Banner杞挱妯″潡
    if (obj.data && obj.data.modules) {
        obj.data.modules = obj.data.modules.filter(module => {
            if (module.moduleName === "Banner杞挱") {
                console.log("鍒犻櫎Banner杞挱妯″潡");
                return false;
            }
            return true;
        });
    }

    // 澶勭悊搴﹀皬婊″€熼挶鍜屽厤娴侀噺鍏ュ彛
    if (obj.data && obj.data.modules) {
        obj.data.modules.forEach(module => {
            if (module.entrances) {
                module.entrances = module.entrances.filter(entrance => {
                    if (["搴﹀皬婊″€熼挶", "鍏嶆祦閲�"].includes(entrance.name)) {
                        console.log(`鍒犻櫎${entrance.name}鍏ュ彛`);
                        return false;
                    }
                    return true;
                });
            }
        });
    }
}

$done({ body: JSON.stringify(obj) });
