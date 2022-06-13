const TIME_MAPPING = {
  '1': '8:00 ~ 8:50',
  '2': '9:00 ~ 9:50',
  '3': '10:10 ~ 11:00',
  '4': '11:10 ~ 12:00',
  'n': '12:10 ~ 13:00',
  '5': '13:20 ~ 14:10',
  '6': '14:20 ~ 15:10',
  '7': '15:30 ~ 16:20',
  '8': '16:30 ~ 17:20',
  '9': '17:30 ~ 18:20',
  'a': '18:30 ~ 19:20',
  'b': '19:30 ~ 20:20',
  'c': '20:30 ~ 21:20'
}
const ORDERS = ['1', '2', '3', '4', 'n', '5', '6', '7', '8', '9', 'a', 'b', 'c'];
const DAYS = ['M', 'T', 'W', 'R', 'F', 'S'];

const GRADE = {
  "全部開課單位": "[1-9]",
  "學士班": "[1-4]",
  "碩士、博士班": "[5-6]",
  "博士班": "[7-9]"
}
const COURSE_TYPE = ['選修', '必修', '通識'];
const BERIEF_CODE = [];
const FIND_COURSE_RESULT_LIMIT = 75;

const APP_URL = `${location.protocol}//${location.host}${location.pathname}`;
const YS = YEAR + SEMESTER;
const DEV = location.hostname === '127.0.0.1';

// const OAUTH_CLIENT_ID = "797878714864-n37e7s68t1lqa5qr6fl7k7ubdie68cff.apps.googleusercontent.com";
// const OAUTH_ORIGIN = DEV ? "http://127.0.0.1:5001" : "https://us-central1-nctuwu-9d0d4.cloudfunctions.net";

const firebaseConfig = {
  apiKey: "AIzaSyD6SXbR9bt2_qA3QwAOIOqIhwNe2kODO3o",
  authDomain: "nthuwu.firebaseapp.com",
  databaseURL: "https://nthuwu.firebaseio.com",
  projectId: "nthuwu",
  storageBucket: "nthuwu.appspot.com",
  messagingSenderId: "797878714864",
  appId: "1:797878714864:web:708ddeb9cc47370da41d35",
  measurementId: "G-V6ERM5RVBX"
};
