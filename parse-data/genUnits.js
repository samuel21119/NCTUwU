const fs = require("fs");
const JSSoup = require("jssoup").default;
const request = require("request");

const url = "http://curricul.site.nthu.edu.tw/app/index.php?Action=mobileloadmod&Type=mobile_um_mstr&Nbr=7307#sm_div_cmb_85_74450";

var output = {};

request(url, (err, resp, body) => {
    var soup = new JSSoup(body);
    var table = new JSSoup(soup.find("tbody"));
    table.findAll("tr").forEach(function(element, index) {
        if (index === 0) {
            return;
        }
        var td = element.findAll("td");
        var code = td[0].text;
        var unit = td[1].text;
        var department = td[2].text;
        if (department === "" || department === "&nbsp;") department = "其他";
        output[department] = output[department] || {};
        output[department][unit] = code;
    })
    console.log(output);
    fs.writeFileSync('department.json', JSON.stringify(output) , 'UTF-8'); 
})