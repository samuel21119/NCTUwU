const fs = require("fs");
const path = require("path");
const axios = require("axios");
axios.get("https://www.ccxp.nthu.edu.tw/ccxp/INQUIRE/JH/OPENDATA/open_course_data.json").then((res) => {
    const data = res.data;
    let date = new Date();
    let year = date.getFullYear() - 1911;
    let semester = 10;
    let month = date.getMonth();
    if (month < 5) {
        year--;
        semester = 20;
    }else if (month == 12) {
        semester = 20;
    }
    try {
        fs.writeFileSync(path.join(__dirname, "..", "js", "config-year.js"), `const YEAR = '${year}', SEMESTER = '${semester}';`);
        var parse = {};
        const YEAR = year + "";
        const SEMESTER = semester + "";

        function getTeacher(raw) {
            var re = "";

            raw = raw.split('\n');
            for (var i = 0; i < raw.length - 1; i++) {
                if (i !== 0) re += ", ";
                for (var j = 0; j < raw[i].length; j++) {
                    if (raw[i][j] === '\t')
                        break;
                    re += raw[i][j];
                }
            }
            return re;
        }
        data.forEach(x => {
            //console.log(x);
            var id = x["科號"]; id = id.replace(/\ /g, "");
            var name = x["課程中文名稱"];
            var credit = x["學分數"];
            var teacher = getTeacher(x["授課教師"]);
            var roomAndTime = x["教室與上課時間"].split('\n');

            var room = ""; var time = "";
            for (var i = 0; i < roomAndTime.length - 1; i++) {
                if (i !== 0) room += ", ", time += ", ";
                room += roomAndTime[i].split('\t')[0];

                time += roomAndTime[i].split('\t')[1];
            }

            var english = !!(x["授課語言"] == "英");

            var type1 = x["必選修說明"];
            var type2 = x["通識類別"];
            var type = 3;
            if (type2.trim().length > 0)
                type = 2;
            else if (type1.indexOf("必修") !== -1)
                type = 1;
            else if (type1.indexOf("選修") !== -1)
                type = 0;
            
            parse[id] = {
                "id": id,
                "name": name,
                "credit": credit,
                "time": time,
                "room": room,
                "teacher": teacher,
                "english": english,
                "type": type
            }
        })
        fs.writeFileSync(path.join(__dirname, "..", "course-data", `${YEAR}${SEMESTER}-data.json`), JSON.stringify(parse) , 'UTF-8'); 

    }catch (e) {
        console.error(e);
    }
    console.log(year, semester);
})

// const data = require("./data.json");