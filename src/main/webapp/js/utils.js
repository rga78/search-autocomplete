
angular.module( "lmUtils", [] )

/**
 * String utilities..
 */
.factory("StringUtils", [ function() {

    var isEmpty = function(s) {
        return angular.isUndefined(s) || !s || s.trim().length == 0;
    }

    return {
        isEmpty: isEmpty
    };

}])

/**
 * Various utilities.
 */
.factory("Utils", [ "StringUtils", function(StringUtils) {

    var onHttpError = function(data, status, headers, config) {
        alert("$http error: (url = " + config.url + ") didn't work: " + status + ": " + data);
    };

    var scrollTop = function() {
        document.body.scrollTop = document.documentElement.scrollTop = 0;
    };

    return {
        onHttpError: onHttpError,
        isEmpty: StringUtils.isEmpty,
        scrollTop: scrollTop
    };

}])

;

