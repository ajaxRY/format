// 身份证号码 格式化 函数
function format(num) {
    var reg = /^\d{17}(\d|X|x)/;
    if (reg.test(num)) {
        var nstr = num.replace(num.substr(-4, 4), "****");
        var word = nstr.substr(-8, 4);
        word = '<strong>' + word + '</strong>';
        var bStr = nstr.replace(nstr.substr(-8, 4), word);
        return bStr;
    }
};
