if (location.search.includes("__debug__"))
    window.onerror = (...arg) => document.querySelector("footer").textContent = arg;

const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    onOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

const hide = elem => elem.classList.add("is-hidden");
const show = elem => elem.classList.remove("is-hidden");

let courseData = {};
let selectedCourse = {};
let department = {}

let filter = {
    department: false,
    departmentRegex: null,
    period: false,
    periodCodes: []
};

let config = {};

let theme = localStorage.getItem("theme") === "dark" ? "dark" : "light";

firebase.initializeApp(firebaseConfig);
firebase.analytics?.();

const db = firebase.database();

const loginInfo = Object.fromEntries(new URLSearchParams(location.search));
if (loginInfo.token) {
    document.getElementById("user-status").textContent = "...";
    document.getElementById("user-status").onclick = undefined;

    window.history.replaceState({}, '', APP_URL);
    firebase.auth().signInWithCustomToken(loginInfo.token).then(user => {
        if (user.additionalUserInfo.isNewUser) {
            firebase.auth().currentUser.updateEmail(loginInfo.email);
            save();
        }
    });
}


db.ref("news/").orderByKey().limitToLast(1).on("value", function (snapshot) {
    const lastReadNews = +localStorage.getItem("lastReadNews");
    const value = snapshot.val();
    const [id, news] = Object.entries(value)[0];
    if (id > lastReadNews)
        Swal.fire({ title: news.title, html: news.content.replace(/\\t/g, "\t"), icon: 'info' })

    localStorage.setItem("lastReadNews", id);
});

firebase.auth().onAuthStateChanged(function (user) {
    document.getElementById("user-status").textContent = user ? `嗨，${user.displayName}，點我登出` : "Login";
    document.getElementById("user-status").onclick = user ? logout : login;

    if (user && !share) {
        db.ref(`user/${firebase.auth().currentUser.uid}/userInfo`).set({
            displayName: user.displayName,
            email: user.email
        });
        db.ref(`user/${firebase.auth().currentUser.uid}/${YEAR}${SEMESTER}`)
            .once("value", function (snapshot) {
                if (!snapshot.val()) return;
                const { course = {}, lastUpdate: remoteLastUpdate } = snapshot.val();
                const isSame = Object.keys(selectedCourse).length === Object.keys(course).length &&
                    Object.keys(course).sort().every((value, index) => value === Object.keys(selectedCourse).sort()[index])
                const localLastUpdate = +localStorage.getItem("lastUpdate");

                if (!isSame) {
                    if (isEmpty(selectedCourse) || new Date(localLastUpdate) < new Date(remoteLastUpdate)) {
                        // sync: remote to local
                        Toast.fire({ text: "已從伺服器更新你的課表" });
                        selectedCourse = course;
                        save(false);
                    } else {
                        // sync: local to remote
                        save();
                    }
                }
                renderAllSelected();
            })
    }
});

const login = () => {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/userinfo.email');
    firebase.auth().signInWithRedirect(provider);    
    //location.replace(`https://accounts.google.com/o/oauth2/auth?client_id=${OAUTH_CLIENT_ID}&response_type=code&scope=email&redirect_uri=${APP_URL}`);
}

const logout = () => {
    firebase.auth().signOut().then(function() {
        location.reload();
    })
}

// Safari sucks.

const supportBigInt = typeof BigInt !== 'undefined';
if (!supportBigInt) BigInt = JSBI.BigInt;

function parseBigInt(value, radix = 36) {
    const add = (a, b) => supportBigInt ? a + b : JSBI.add(a, b);
    const mul = (a, b) => supportBigInt ? a * b : JSBI.multiply(a, b);
    return [...value.toString()]
        .reduce((r, v) => add(
            mul(r, BigInt(radix)),
            BigInt(parseInt(v, radix))
        ), BigInt(0));
}

function loadFromShareLink() {
    const shareKey = new URLSearchParams(location.search).get("share");
    const rawCourseUnits = shareKey.split(",");
    const courseUnits = rawCourseUnits.reduce((a, b) => {
        const times = parseInt((b.match(/\d+/) || [1])[0]);
        const unit = b.match(/[A-Z]+/);
        a.push((unit === null ? b : Array(times).fill(unit[0])));
        return a;
    }, []).flat();
    const courseNumbers = parseBigInt(courseUnits[courseUnits.length - 1]).toString().match(/.{6}/g);
    return courseNumbers.reduce((a, b, c) => (a[`${YS}${courseUnits[c]}${b}`] = true, a), {});
}

function loadFromLocalStorage() {
    return JSON.parse(localStorage.getItem(`selectedCourse${YS}`)) || {};
}

const totalCredits = () => Object.keys(selectedCourse).reduce((accu, id) => +courseData[id].credit + accu, 0);

let share = false;
if (location.search.includes("share=")) {
    share = true;
    hide(document.querySelector(".sidebar"));
    hide(document.querySelector("#clear-table"));
    show(document.querySelector("#import"));
}

function changeTheme() {
    if (theme === "light") {
        document.getElementById("body").classList.remove("dark");
        document.getElementById("navbar").classList.remove("is-dark");
        document.getElementById("navbar").classList.add("is-light");
        hide(document.getElementById("dark-mode"));
        show(document.getElementById("light-mode"));
    }else if (theme === "dark") {
        document.getElementById("body").classList.add("dark");
        document.getElementById("navbar").classList.remove("is-light");
        document.getElementById("navbar").classList.add("is-dark");
        hide(document.getElementById("light-mode"));
        show(document.getElementById("dark-mode"));
    }
}
changeTheme();

// Render timetable.
ORDERS.forEach(period => {
    const row = document.createElement("tr");
    const time = document.createElement('th');
    const cha1 = document.createElement("span");
    const cha2 = document.createElement("span");
    cha1.textContent = `${period}`;
    cha2.setAttribute("style", "display: var(--showTime-Style);")
    cha2.textContent = `${TIME_MAPPING[period]}`;
    time.appendChild(cha1);
    time.appendChild(document.createElement("br"));
    time.appendChild(cha2);
    const isExtra = (period.match(/[a-cn]/) !== null);
    if (isExtra)
        time.classList.add('extra');
    row.appendChild(time);
    document.querySelector(".timetable tbody").appendChild(row);
    DAYS.forEach(day => {
        const periodCode = `${day}${period}`;
        const block = document.createElement('td');
        block.id = periodCode;
        if (day === "S")
            block.classList.add('weekend');
        if (isExtra)
            block.classList.add('extra');

        const overlay = document.createElement("div");
        overlay.className = "find-empty-overlay";
        overlay.append(...['horizontal', 'vertical'].map(className => {
            const div = document.createElement("div");
            div.className = className;
            div.dataset.periodCode = periodCode;
            return div;
        }));
        overlay.onclick = () => {
            const periodCode = overlay.parentNode.id;
            togglePeriodFilter(periodCode);
        };
        block.appendChild(overlay);
        row.appendChild(block);
    });
});

const settingOptions = [
    {
        key: "trimTimetable",
        description: "我中午、晚上不用上課",
        callback: value => value ?
            document.querySelectorAll(".extra").forEach(hide) :
            document.querySelectorAll(".extra").forEach(elem =>
                (!elem.classList.contains("weekend") || !config.hideWeekend) && show(elem)
            )
    }, {
        key: "hideWeekend",
        description: "我週末沒課",
        callback: value => value ?
            document.querySelectorAll(".weekend").forEach(hide) :
            document.querySelectorAll(".weekend").forEach(elem =>
                (!elem.classList.contains("extra") || !config.trimTimetable) && show(elem)
            )
    }, {
        key: "hideTag",
        description: "隱藏課程列表中的 tag",
        callback: value => {
            const cssSheet = document.getElementById("custom-style").sheet;
            value ?
                cssSheet.insertRule(".course .tag{display: none;}", 0) :
                cssSheet.cssRules.length && cssSheet.deleteRule(0)
        }
    }, {
        key: "showLocation",
        description: "顯示修課教室",
        callback: value => {
            const body = document.getElementById("body");
            value ?
                body.classList.add("showRoom") :
                body.classList.remove("showRoom")
        }
    }, {
        key: "showTime",
        description: "顯示時間",
        callback: value => {
            const body = document.getElementById("body");
            value ?
                body.classList.add("showTime") :
                body.classList.remove("showTime")
        }
    }

];

renderConfig(settingOptions);

// Fetch course data.
Promise.all([
    `course-data/${YS}-data.json`,
    `course-data/department.json`
].map(url => fetch(url).then(r => r.json())))
    .then(response => {
        const [data, department] = response;

        courseData = data;
        console.log(123);
        selectedCourse = share ? loadFromShareLink() : loadFromLocalStorage();

        document.querySelector(".input").disabled = false;
        document.querySelector(".input").placeholder = "課號 / 課名 / 老師";
        console.log(selectedCourse);
        document.querySelector(".credits").textContent = `${totalCredits()} 學分`;
        renderAllSelected();
        renderDepartment(department);
    });

function setFilter(filterData) {
    Object.entries(filterData)
        .forEach(([key, value]) => {
            if (key in filter)
                filter[key] = value;
            else
                throw `${key} not in filter!`;
        });
    renderSearchResult();
}


function togglePeriodFilter(periodCode) {
    const periodCodes = new Set(filter.periodCodes);
    periodCodes.has(periodCode) ?
        periodCodes.delete(periodCode) :
        periodCodes.add(periodCode);
    setFilter({
        period: periodCodes.size !== 0,
        periodCodes: [...periodCodes]
    });
    document.getElementById("search-period").innerHTML = "";
    document.getElementById("search-period").append(
        ...[...periodCodes].map(code =>
            createTag(code, 'is-info', elem => {
                elem.remove();
                togglePeriodFilter(code);
            }))
    );

    document.getElementById(periodCode).querySelector('.find-empty-overlay').classList.toggle('selected');
}

function renderConfig(options) {
    const storedConfig = JSON.parse(localStorage.getItem("timetableConfig")) || {};
    options.forEach(rule => {
        const label = document.createElement("label");
        label.className = "checkbox";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.onclick = ({ target }) => {
            config[rule.key] = target.checked;
            localStorage.setItem("timetableConfig", JSON.stringify(config));
            rule.callback(target.checked);
        };
        checkbox.checked = !!storedConfig[rule.key];
        label.appendChild(checkbox);
        label.append(" " + rule.description);
        document.querySelector("#setting .dropdown-item").appendChild(label);

        config[rule.key] = checkbox.checked;
        rule.callback(checkbox.checked);
    });

    config = storedConfig;
}

function renderDepartment(department) {
    const renderSelect = (id, options) => {
        if (id == 3) options = GRADE;
        document.querySelector(`.department[data-level="${id}"]`).parentElement.classList.remove('is-hidden')
        document.querySelector(`.department[data-level="${id}"]`).innerHTML =
            (id === 1 ? "<option selected>全部開課單位</option>" : "<option disabled selected>選擇開課單位</option>") +
            Object.entries(options).map(
                ([name]) => `<option>${name}</option>`
            ).join('');
    }
    renderSelect(1, department);
    document.querySelectorAll('select').forEach((elem, _, selects) =>
        elem.onchange = ({ target }) => {
            const level = +target.dataset.level;
            let currentValue;
            if (level === 1) {
                if (elem.value === "全部開課單位") {
                    setFilter({ department: false, departmentRegex: -1 });
                    hide(selects[1].parentElement);
                    hide(selects[2].parentElement);
                    return;
                }
                currentValue = department[elem.value];
            }
            else if (level === 2)
                currentValue = department[selects[0].value][elem.value];
            else
                currentValue = "[0-9]" + department[selects[0].value][selects[1].value] + GRADE[elem.value];
            
            const hasNextLevel = !!(level <= 2);
            if (hasNextLevel)
                renderSelect(level + 1, currentValue)
            else
                setFilter({ department: true, departmentRegex: (new RegExp(currentValue)) });

            selects.forEach(select =>
                (+select.dataset.level > level + hasNextLevel) &&
                hide(select.parentElement)
            );
        }
    )
}

function renderAllSelected() {
    document.querySelector(".credits").textContent = `${totalCredits()} 學分`;
    document.querySelectorAll(".timetable .period").forEach(elem => elem.remove())
    document.querySelector(".selected").innerHTML = '';
    for (courseId in selectedCourse) {
        const course = courseData[courseId];
        renderPeriodBlock(course);
        appendCourseElement(course);
    }
}

function getCourseIdFromElement(element) {
    return element.closest('.course,.period').dataset.id;
}

document.addEventListener("click", function ({ target }) {
    if (target.classList.contains('toggle-course'))
        toggleCourse(getCourseIdFromElement(target));

    if (target.classList.contains('modal-launcher'))
        openModal(getCourseIdFromElement(target));
})

document.addEventListener("mouseover", function (event) {
    if (event.target.matches('.result .course, .result .course *')) {
        const courseId = getCourseIdFromElement(event.target);
        const result = parseTime(courseData[courseId].time);

        result.forEach(period => {
            const block = document.getElementById(period);
            block.querySelector(".period:not(.preview)")?.classList.add("has-background-danger", "has-text-white");
        });
        renderPeriodBlock(courseData[courseId], true);
    }
})

document.addEventListener("mouseout", function (event) {
    if (event.target.matches('.result .course, .result .course *')) {
        document.querySelectorAll('.timetable .period.preview')
            .forEach(elem => elem.remove());
        document.querySelectorAll(".timetable .period")
            .forEach(elem => elem.classList.remove("has-background-danger", "has-text-white"))
    }
})

function openModal(courseId) {
    const modal = document.querySelector('.modal');
    modal.classList.add('is-active')

    const data = courseData[courseId];
    const fields = modal.querySelectorAll('dd');
    fields[0].textContent = data.id;
    fields[1].textContent = data.credit;
    fields[2].textContent = data.teacher;
    fields[3].textContent = data.time;
    fields[4].textContent = data.room;

    modal.querySelector('.card-header-title').textContent = data.name;
    // modal.querySelector('#outline').href = `https://timetable.nctu.edu.tw/?r=main/crsoutline&Acy=${YEAR}&Sem=${SEMESTER}&CrsNo=${courseId}&lang=zh-tw`;
    modal.querySelector('#outline').href = `https://www.ccxp.nthu.edu.tw/ccxp/INQUIRE/JH/6/6.2/6.2.9/JH629001.php`;
}

function createTag(text, type, closeCallback) {
    const tag = document.createElement("span");
    tag.className = `tag is-rounded ${type}`;
    tag.textContent = text;
    if (closeCallback) {
        const close = document.createElement("button");
        close.className = "delete is-small";
        close.onclick = () => closeCallback(tag);
        tag.appendChild(close);
    }
    return tag;
}

function appendCourseElement(courses, search = false) {
    if (!Array.isArray(courses)) courses = [courses];

    const fragment = document.createDocumentFragment();
    courses.forEach(course => {
        const template = document.importNode(document.getElementById("courseTemplate").content, true);
        if (course.type < 3) {
            template.getElementById("type").textContent = COURSE_TYPE[course.type];
            const typeColor = course.type === 0 ? 'is-white' :
                course.type === 1 ? 'is-danger' :
                    'is-primary';
            template.getElementById("type").className = `tag is-rounded ${typeColor}`;
        }else {
            template.getElementById("type").remove();
        }
        template.getElementById("name").textContent = course.name;

        if (course.english)
            template.querySelector(".chips").appendChild(createTag("英文授課", "is-success"));

        template.getElementById("detail").textContent = `${course.id}・${course.teacher}・${+course.credit} 學分`;
        template.querySelector(".course").dataset.id = course.id;
        template.querySelector(".toggle-course").classList.toggle('is-selected', course.id in selectedCourse)

        fragment.appendChild(template);
    });
    document.querySelector(search ? ".result" : ".selected").appendChild(fragment);
}

function search(searchTerm) {
    if (!searchTerm &&
        !(filter.department) &&
        !(filter.period)
    ) return [];

    const regex = RegExp(searchTerm, 'i');
    const regex2 = RegExp(searchTerm.replace(/\ /g, ''), 'i');
    const result = Object.values(courseData)
        .filter(course => ((
            course.id.match(regex) ||
            course.id.match(regex2) ||
            course.teacher.match(regex) ||
            course.name.match(regex)) &&
            (!filter.department || course.id.match(filter.departmentRegex)) && 
            (!filter.period || filter.periodCodes.some(code => (course.time.match(code) !== null)))
        )).slice(0, FIND_COURSE_RESULT_LIMIT);

    return result;
}

function isEmpty(obj) {  
    for (var prop in obj)
        return false;  
    return true;  
} 

function save(remote = true) {
    const lastUpdate = +new Date();
    localStorage.setItem(`selectedCourse${YEAR}${SEMESTER}`, JSON.stringify(selectedCourse));
    localStorage.setItem("lastUpdate", +new Date());

    if (!isEmpty(selectedCourse) && firebase.auth().currentUser && remote)
        db.ref(`user/${firebase.auth().currentUser.uid}/${YEAR}${SEMESTER}`).set({
            course: selectedCourse,
            lastUpdate: lastUpdate
        });
}

function toggleCourse(courseId) {
    const button = document.querySelector(`.course[data-id="${courseId}"] .toggle-course`);
    if (courseId in selectedCourse) { // Remove course
        delete selectedCourse[courseId];

        document.querySelector(`.selected [data-id="${courseId}"]`).remove();
        document.querySelectorAll(`.period[data-id="${courseId}"]`).forEach(elem => elem.remove());
        button?.classList.remove('is-selected');
    } else { // Select course
        const periods = parseTime(courseData[courseId].time);
        const isConflict = periods.some(period => document.getElementById(period).querySelector(".period:not(.preview)"))
        if (isConflict) {
            Toast.fire({
                icon: 'error',
                title: "和目前課程衝堂了欸"
            });
            return;
        }
        selectedCourse[courseId] = true;
        appendCourseElement(courseData[courseId]);
        renderPeriodBlock(courseData[courseId]);
        button?.classList.add('is-selected');
    }
    save();
    document.querySelector(".credits").textContent = `${totalCredits()} 學分`;
}

function parseTime(timeCode) {
    const timeList = timeCode.match(/[MTWRFS][1-9nabc]/g);
    if (!timeList) return [];

    const result = timeList.map(
        code => [...code].map(char => `${code[0]}${char}`).slice(1)
    ).flat();

    return result;
}

function getLocation(course, period, periodBlock) {
    var clone = periodBlock.cloneNode(true);
    const splTime = course["time"].split(",");
    const splRoom = course["room"].split(",");
    const loc = document.createElement("span");
    loc.setAttribute("style", "position: absolute; width: 100%; font-size: 12px; bottom: 0px; display: var(--room-show)");
    for (var i = 0; i < splTime.length; i++) {
        if (splTime[i].indexOf(period) != -1) {
            loc.textContent = splRoom[i].replace(/\ /g, "");
            break;
        }
    }
    clone.appendChild(loc);
    return clone;
}

function renderPeriodBlock(course, preview = false) {
    const periods = parseTime(course.time);

    const periodBlock = document.createElement("div");
    periodBlock.dataset.id = course.id;
    periodBlock.className = "period modal-launcher";
    if (preview) periodBlock.className += ' preview';
    const text = document.createElement("span");
    text.textContent = course.name;
    periodBlock.appendChild(text);
    periods.forEach(period => {
        const blank = document.getElementById(period);
        const existBlock = blank.querySelector(".period");
        console.log(period, course);
        if (existBlock && existBlock.dataset.id === course.id) {
            existBlock.classList.remove("preview");
        } else if (!blank.querySelector(".period:not(.preview)")) {
            const clone = document.importNode(getLocation(course, period, periodBlock), true);
            blank.appendChild(clone)
        }
    });
}

function renderSearchResult(searchTerm) {
    document.querySelector(".result").innerHTML = '';
    if (typeof searchTerm === 'undefined')
        searchTerm = document.querySelector(".input").value.trim();
    const result = search(searchTerm);
    appendCourseElement(result, true);
}

document.querySelector(".input").oninput = event => {
    const searchTerm = event.target.value.trim();
    if (searchTerm.includes("'"))
        document.querySelector(".result").textContent = "1064 - You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near ''' at line 1.";

    renderSearchResult(searchTerm);
}

document.getElementById("import").onclick = () => {
    Swal.fire({
        title: '匯入課表',
        text: "接下來將會覆蓋你目前的課表ㄛ，確定嗎？",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: '匯入'
    }).then(result => {
        if (result.value) {
            save();
            Toast.fire({
                title: `<a href=${APP_URL}>匯入完成！點此前往選課模擬</a>`,
                icon: "success"
            });
        }
    })
}

function getShareKey() {
    const unitsCnt = Object.keys(selectedCourse).reduce((a, b) => (a[b.replace(/[0-9]/g, "")] = a[b.replace(/[0-9]/g, "")] + 1 || 1, a), {});
    const unitsNumbers = Object.keys(selectedCourse).reduce((a, b) => {
        const key = b.replace(/[0-9]/g, "");
        const number = b.match(/\d+$/)[0];
        console.log(number);
        a[key] = a[key] === undefined ? number : a[key] + number;
        return a;
    }, {});
    const units = Object.keys(unitsCnt).reduce((a, b) => (a += `${(unitsCnt[b] === 1 ? "" : unitsCnt[b])}${b},`), "");
    const numbers = BigInt(Object.entries(unitsNumbers).reduce((a, b) => (a += b[1], a), "")).toString(36);
    return units + numbers;
}

document.getElementById("copy-link").onclick = () => {
    const shareKey = getShareKey();

    const link = `${APP_URL}?share=${shareKey}`;
    const copy = document.createElement("div");
    copy.textContent = link;
    document.body.appendChild(copy);

    const textRange = document.createRange();
    textRange.selectNode(copy);
    const selet = window.getSelection();
    selet.removeAllRanges();
    selet.addRange(textRange);

    try {
        document.execCommand('copy');
        Toast.fire({
            title: `<a href="${link}" target="_blank">複製好了！點此可直接前往</a>`,
            icon: "success"
        });
    } catch (err) {
        console.log('Oops, unable to copy');
    }

    document.body.removeChild(copy);
}

document.getElementById("download").onclick = () => {
    const scale = 2;
    const domNode = document.getElementsByClassName("table-container")[0];
    domtoimage.toPng(domNode, {
        width: domNode.scrollWidth * scale,
        height: domNode.scrollHeight * scale,
        style: {
            transform: 'scale('+scale+')',
            transformOrigin: 'top left'
        }
    }).then(function (dataUrl) {
        var link = document.createElement('a');
        link.download = '課程表.png';
        link.href = dataUrl;
        link.click();
    });
}

document.getElementById("clear-table").onclick = () => {
    Swal.fire({
        title: '刪除課表',
        text: "刪除後的資料無法復原，確定嗎？",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: '刪除'
      }).then((result) => {
        if (result.value) {
            const selectedDom = document.getElementsByClassName("selected course-list")[0];
            const courseDoms = selectedDom.getElementsByClassName("toggle-course is-selected");
            var cnt = courseDoms.length;
            while (cnt-- > 0) courseDoms[0].click();
        }
      })
}

document.querySelector('.modal-background').onclick =
    document.querySelector('.card-header-icon').onclick =
    () => document.querySelector('.modal').classList.remove('is-active');

document.getElementById("light-mode").onclick = () => {
    theme = "dark";
    localStorage.setItem("theme", theme);
    changeTheme();
}

document.getElementById("dark-mode").onclick = () => {
    theme = "light";
    localStorage.setItem("theme", theme);
    changeTheme();
}
