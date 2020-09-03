let courseData = {};
let selectedCourse = {};

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
    return JSON.parse(localStorage.getItem("selectedCourse")) || {};
}

const totalCredits = () => Object.keys(selectedCourse).reduce((accu, id) => +courseData[id].credit + accu, 0);

let share = false;
if (location.search.includes("share=")) {
    share = true;
    document.querySelector(".sidebar").classList.add("is-hidden");
    document.querySelector("#import").classList.remove("is-hidden");
    document.querySelector(".loading").classList.remove("is-hidden");
}

// Render timetable.
ORDERS.forEach(period => {
    const div = document.createElement("div");
    div.textContent = `${period} / ${TIME_MAPPING[period]}`;
    document.querySelector(".time-interval").appendChild(div);
});

ORDERS.forEach(period => {
    DAYS.forEach(day => {
        const div = document.createElement("div");
        div.id = `${day}${period}`;
        document.querySelector('.content').appendChild(div);
    }); 
});

// Fetch course data.
fetch(`course-data/${YEAR}${SEMESTER}-data.json`)
    .then(r => r.json())
    .then(data => {
        courseData = data;
        selectedCourse = share ? loadFromShareLink() : loadFromLocalStorage();

        document.querySelector(".input").disabled = false;
        document.querySelector(".input").placeholder = "課號 / 課名 / 老師";
        document.querySelector(".loading").classList.add("is-hidden");
        for (courseId in selectedCourse) {
            const course = courseData[courseId];
            renderPeriodBlock(course);
            appendCourseElement(course);
        }
        document.querySelector(".credits").textContent = `${totalCredits()} 學分`;
    });

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
            if (block.childElementCount)
                block.firstElementChild.classList.add("has-background-danger", "has-text-white");
            block.classList.add('has-background-info-light')
        })
    }
})

document.addEventListener("mouseout", function (event) {
    if (event.target.matches('.result .course, .result .course *')) {
        document.querySelectorAll('.timetable>.content>[class="has-background-info-light"]')
            .forEach(elem => {
                elem.className = '';
                elem.firstElementChild?.classList.remove("has-background-danger", "has-text-white");
            });
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

function appendCourseElement(course, search = false) {
    const template = document.getElementById("courseTemplate");
    template.content.querySelector(".tag").textContent = course.id;
    template.content.getElementById("name").textContent = course.name;
    template.content.getElementById("detail").textContent = `${course.teacher}・${+course.credit} 學分`;
    template.content.querySelector(".course").dataset.id = course.id;
    template.content.querySelector(".toggle-course").classList.toggle('is-selected', course.id in selectedCourse)

    const clone = document.importNode(template.content, true);
    document.querySelector(search ? ".result" : ".selected").appendChild(clone);
}

function search(searchTerm) {
    if (!searchTerm) return [];

    const regex = RegExp(searchTerm, 'i');
    const regex2 = RegExp(searchTerm.replace(/\ /g, ''), 'i');
    const result = Object.values(courseData)
        .filter(course => (
            course.id.match(regex) ||
            course.id.match(regex2) ||
            course.teacher.match(regex) ||
            course.name.match(regex)
        ))
        .slice(0, 50);

    return result;
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
        const isConflict = periods.some(period => document.getElementById(period).childElementCount)
        if (isConflict) {
            Toastify({
                text: "和目前課程衝堂了欸",
                backgroundColor: "linear-gradient(147deg, #f71735 0%, #db3445 74%)",
                close: true,
                duration: 3000
            }).showToast();
            return;
        }

        selectedCourse[courseId] = true;
        appendCourseElement(courseData[courseId]);
        renderPeriodBlock(courseData[courseId]);
        button?.classList.add('is-selected');
    }

    localStorage.setItem("selectedCourse", JSON.stringify(selectedCourse));
    document.querySelector(".credits").textContent = `${totalCredits()} 學分`;
}

function parseTime(timeCode) {
    const timeList = timeCode.match(/[MTWRFS][1-9nabc]/g);
    const result = timeList.map(
        code => [...code].map(char => `${code[0]}${char}`).slice(1)
    ).flat();

    return result;
}

function renderPeriodBlock(course) {
    const periods = parseTime(course.time);
    periods.forEach(period => document.getElementById(period).innerHTML = `
    <div data-id="${course.id}" class="period modal-launcher">
        <span>${course.name}</span>
    </div>`);
}

document.querySelector(".input").oninput = event => {
    document.querySelector(".result").innerHTML = '';
    const searchTerm = event.target.value.trim();
    if (searchTerm.includes("'"))
        document.querySelector(".result").textContent = "1064 - You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near ''' at line 1.";

    const result = search(searchTerm);

    result.forEach(course => appendCourseElement(course, true));
}

document.getElementById("import").onclick = () => {
    if (confirm("接下來將會覆蓋你的目前課表ㄛ，確定嗎？")) {
        localStorage.setItem("selectedCourse", JSON.stringify(selectedCourse));
        Toastify({
            text: "匯入完成！點此前往選課模擬",
            destination: APP_URL,
            close: true,
            duration: 3000
        }).showToast();
    }
}

function getShareKey() {
    const units_cnt = Object.keys(selectedCourse).reduce((a, b) => (a[b.replace(/[0-9]/g, "")] = a[b.replace(/[0-9]/g, "")] + 1 || 1, a), {});
    const units = Object.keys(units_cnt).reduce((a, b) => (a += `${(units_cnt[b] === 1 ? "" : units_cnt[b])}${b},`), "");
    const numbers = BigInt(Object.keys(selectedCourse).reduce((a, b) => (a += b.match(/\d+$/)[0], a), "")).toString(36);
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

        Toastify({
            text: "複製好了！點此可直接前往",
            destination: link,
            newWindow: true,
            close: true,
            duration: 3000
        }).showToast();
    } catch (err) {
        console.log('Oops, unable to copy');
    }

    document.body.removeChild(copy);
}

document.querySelector('.modal-background').onclick =
    document.querySelector('.card-header-icon').onclick =
    () => document.querySelector('.modal').classList.remove('is-active');

document.getElementById("download-photo").onclick = () => {
    var scale = 2;
    const domNode = document.getElementsByClassName("timetable")[0];
    domtoimage.toPng(domNode, {
        bgcolor: "#ffffff",
        width: domNode.clientWidth * scale,
        height: domNode.clientHeight * scale,
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
