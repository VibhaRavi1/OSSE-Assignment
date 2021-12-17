var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8204,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004f0062-0097-0085-00cd-00ae001a00dd.png",
        "timestamp": 1622118067138,
        "duration": 2577
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8204,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002b0047-0096-0068-0049-0071004500af.png",
        "timestamp": 1622118070192,
        "duration": 85
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8204,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008f00fd-00be-0025-0007-0027000000dd.png",
        "timestamp": 1622118070548,
        "duration": 66
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8204,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007b00f4-00d7-007d-0006-00d100c50040.png",
        "timestamp": 1622118070858,
        "duration": 73
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8204,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b30042-003f-00b4-00e0-002100f20062.png",
        "timestamp": 1622118071206,
        "duration": 1821
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8204,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001b0040-006e-0027-00df-00c8004c002d.png",
        "timestamp": 1622118073340,
        "duration": 346
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13832,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005a00cd-00f6-00fd-002f-000d000c004d.png",
        "timestamp": 1622118132796,
        "duration": 1668
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13832,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c000ed-00af-0058-002a-00b900cd007c.png",
        "timestamp": 1622118134964,
        "duration": 87
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13832,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0026007c-0053-003c-0002-004000ee0042.png",
        "timestamp": 1622118135336,
        "duration": 59
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13832,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0084007e-00db-001a-0066-0058000e00bd.png",
        "timestamp": 1622118135622,
        "duration": 62
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13832,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00530014-00fb-00ec-00cc-005f000400bd.png",
        "timestamp": 1622118135870,
        "duration": 3273
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13832,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a600a6-00b3-00aa-0031-008f00be00ad.png",
        "timestamp": 1622118139409,
        "duration": 246
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17964,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d60086-0066-0068-000c-00ed00d300b8.png",
        "timestamp": 1622118160872,
        "duration": 1518
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17964,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002c00b7-0090-0024-0051-00c300880022.png",
        "timestamp": 1622118162876,
        "duration": 66
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17964,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00480025-003c-001f-00f9-00c200850022.png",
        "timestamp": 1622118163197,
        "duration": 77
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17964,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002700b8-003f-0019-0079-006a007c0036.png",
        "timestamp": 1622118163508,
        "duration": 56
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17964,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00020052-00b8-00d5-00d3-00cc00bb00f9.png",
        "timestamp": 1622118163759,
        "duration": 3061
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17964,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b6002b-00eb-00a5-0017-00670065007d.png",
        "timestamp": 1622118166975,
        "duration": 295
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18328,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c00082-00ee-00ba-0001-0093000400f1.png",
        "timestamp": 1622118183409,
        "duration": 1527
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18328,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001d00bf-005c-0076-00ae-00c200fd004e.png",
        "timestamp": 1622118185457,
        "duration": 99
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18328,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002b00d0-0020-002c-00ff-00c500890092.png",
        "timestamp": 1622118185789,
        "duration": 54
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18328,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ca0047-00c3-00d8-0031-006300710000.png",
        "timestamp": 1622118186033,
        "duration": 60
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18328,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(data:text/html,<html></html>)\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:673:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622118186329,
        "duration": 2278
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18328,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: By(css selector, *[id=\"getBtn\"])\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:27:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Check Get Button Message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:26:4)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622118188657,
        "duration": 26
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22780,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001600a7-0011-0018-0023-00cc005c00b1.png",
        "timestamp": 1622118223742,
        "duration": 1749
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22780,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002e000e-00a8-009d-00b8-00f200080086.png",
        "timestamp": 1622118225959,
        "duration": 69
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22780,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006f0036-0002-0069-00c5-00b6008d006e.png",
        "timestamp": 1622118226267,
        "duration": 127
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22780,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005d0070-0041-0007-00cf-009b007b00f6.png",
        "timestamp": 1622118226615,
        "duration": 60
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 22780,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(data:text/html,<html></html>)\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:673:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622118226866,
        "duration": 2228
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 22780,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: By(css selector, *[id=\"getBtn\"])\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:27:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Check Get Button Message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:26:4)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622118229158,
        "duration": 31
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20956,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00150015-00e2-00e0-00c2-009c00b9005d.png",
        "timestamp": 1622118270605,
        "duration": 1697
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20956,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a200e5-0097-0007-00a0-00a2001a009a.png",
        "timestamp": 1622118272689,
        "duration": 85
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20956,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b20024-004b-00a8-00be-007d007600ca.png",
        "timestamp": 1622118272957,
        "duration": 46
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 20956,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c800ed-00a3-005b-0085-007b000800c2.png",
        "timestamp": 1622118273165,
        "duration": 59
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 20956,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.refresh() - getUrl\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeScriptWithDescription (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:402:28)\n    at ProtractorBrowser.refresh (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:784:14)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:23:14)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622118273451,
        "duration": 2251
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 20956,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: By(css selector, *[id=\"getBtn\"])\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:27:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Check Get Button Message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:26:4)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622118275748,
        "duration": 17
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 25580,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00690067-00f5-002c-000e-0015007a00b8.png",
        "timestamp": 1622118360332,
        "duration": 1640
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 25580,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00df0073-002a-0001-0061-005d00310023.png",
        "timestamp": 1622118362458,
        "duration": 101
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 25580,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00760045-0024-0025-0067-002a003f00ac.png",
        "timestamp": 1622118362754,
        "duration": 76
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 25580,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009a00f9-004a-0001-006c-001b000c0042.png",
        "timestamp": 1622118363061,
        "duration": 139
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 25580,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "NoSuchAlertError: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.switchTo().alert()\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at TargetLocator.alert (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1862:29)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:23:25)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622118363456,
        "duration": 326
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 25580,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: By(css selector, *[id=\"getBtn\"])\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:27:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Check Get Button Message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:26:4)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622118364015,
        "duration": 74
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 27448,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f90057-0005-00f2-001f-008800a50023.png",
        "timestamp": 1622118478550,
        "duration": 1427
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 27448,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008c00bb-00c3-0084-0048-007100670050.png",
        "timestamp": 1622118480519,
        "duration": 76
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 27448,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ba00ff-00d6-0067-0023-004b00f00036.png",
        "timestamp": 1622118480846,
        "duration": 68
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 27448,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00460096-00a2-0027-0046-00d7008000f7.png",
        "timestamp": 1622118481136,
        "duration": 57
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 27448,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "NoSuchAlertError: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.switchTo().alert()\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at TargetLocator.alert (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1862:29)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:23:31)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622118481369,
        "duration": 200
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 27448,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: By(css selector, *[id=\"getBtn\"])\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:27:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Check Get Button Message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:26:4)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622118481664,
        "duration": 51
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 27056,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ad0056-0052-0052-00f2-002c00720085.png",
        "timestamp": 1622118559408,
        "duration": 1898
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 27056,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b50041-007c-009c-00b8-00c20077004f.png",
        "timestamp": 1622118561866,
        "duration": 157
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 27056,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002c00f5-004e-007d-00b9-006400a30057.png",
        "timestamp": 1622118562318,
        "duration": 100
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 27056,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008700b1-0012-00ac-0098-009b00bc008a.png",
        "timestamp": 1622118562711,
        "duration": 71
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 27056,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: driver is not defined"
        ],
        "trace": [
            "ReferenceError: driver is not defined\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:23:6)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622118563013,
        "duration": 255
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 27056,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: By(css selector, *[id=\"getBtn\"])\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:27:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Check Get Button Message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:26:4)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622118563483,
        "duration": 67
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26948,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00bc00ed-0041-00a0-0093-0035004d0034.png",
        "timestamp": 1622118795998,
        "duration": 1847
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26948,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cc002b-00f3-0007-0011-00870054005b.png",
        "timestamp": 1622118798308,
        "duration": 101
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26948,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a20073-00cb-00e6-002c-00d100e200f3.png",
        "timestamp": 1622118798705,
        "duration": 85
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26948,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003b00c4-00a0-00fb-00e8-00ff007c004d.png",
        "timestamp": 1622118799040,
        "duration": 66
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26948,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00580010-00e5-0001-0076-002800050002.png",
        "timestamp": 1622118799370,
        "duration": 480
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26948,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009f00ff-00f3-00d8-00bd-003e00ef001f.png",
        "timestamp": 1622118800569,
        "duration": 357
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 27020,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002300a9-009a-003c-0005-001e0086000c.png",
        "timestamp": 1622118839790,
        "duration": 1504
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 27020,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a700f6-0085-0086-0097-003f00f600ed.png",
        "timestamp": 1622118841743,
        "duration": 69
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 27020,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c7003d-000a-007e-00de-006c00060047.png",
        "timestamp": 1622118842004,
        "duration": 53
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 27020,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000300e3-00e2-00d4-00ca-0055003f0041.png",
        "timestamp": 1622118842240,
        "duration": 56
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 27020,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(http://localhost:4200/)\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:23:27)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622118842486,
        "duration": 2224
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 27020,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: By(css selector, *[id=\"getBtn\"])\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:28:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Check Get Button Message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:27:4)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622118844762,
        "duration": 21
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26816,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d4008d-00e2-0028-005a-005300610041.png",
        "timestamp": 1622118902335,
        "duration": 1947
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26816,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001b008c-0058-00e0-00ff-008c00180082.png",
        "timestamp": 1622118904705,
        "duration": 76
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26816,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e20029-0017-009b-0072-001400d20008.png",
        "timestamp": 1622118905022,
        "duration": 49
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26816,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00150006-00b2-0084-00a0-00c8009900c9.png",
        "timestamp": 1622118905259,
        "duration": 52
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 26816,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(http://localhost:4200/)\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:23:27)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622118905482,
        "duration": 2205
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 26816,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: By(css selector, *[id=\"getBtn\"])\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:28:19)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Check Get Button Message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:27:4)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622118907731,
        "duration": 20
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26940,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002a00a0-00c4-0010-00c4-00750024003c.png",
        "timestamp": 1622118980869,
        "duration": 2594
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26940,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00960032-00bc-007c-009d-00e900db00c8.png",
        "timestamp": 1622118984366,
        "duration": 111
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26940,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009300e0-0040-0014-00ba-008300db00e9.png",
        "timestamp": 1622118984787,
        "duration": 131
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26940,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000a000f-00b4-0024-0066-005100b700db.png",
        "timestamp": 1622118985209,
        "duration": 93
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 26940,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "NoSuchAlertError: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.switchTo().alert()\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at TargetLocator.alert (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1862:29)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:23:31)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00e4000e-0003-00ce-00b1-00b200b90007.png",
        "timestamp": 1622118985616,
        "duration": 676
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26940,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cf00f5-00bc-0012-00e4-00cc00b500e6.png",
        "timestamp": 1622118986578,
        "duration": 331
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19596,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0001005b-0032-009e-0058-00aa006c00fe.png",
        "timestamp": 1622119020406,
        "duration": 1282
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19596,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0062008e-00dc-0028-0014-00340011004c.png",
        "timestamp": 1622119022146,
        "duration": 69
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19596,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00170055-009d-007c-0033-001c008e008d.png",
        "timestamp": 1622119022429,
        "duration": 51
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19596,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e30055-006a-00d9-0016-000800f2008a.png",
        "timestamp": 1622119022657,
        "duration": 73
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 19596,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "NoSuchAlertError: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.switchTo().alert()\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at TargetLocator.alert (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1862:29)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:23:31)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00e700bd-0064-000b-0024-002d00d60068.png",
        "timestamp": 1622119022932,
        "duration": 385
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19596,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002c00bd-00cb-00f9-0042-00c900510024.png",
        "timestamp": 1622119023522,
        "duration": 267
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11300,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008000b6-00b5-0093-0043-008300e20060.png",
        "timestamp": 1622119134852,
        "duration": 1751
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11300,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00790046-005a-0013-0085-00a3001a0094.png",
        "timestamp": 1622119137124,
        "duration": 80
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11300,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004a001f-0015-00ff-00d8-00b200a20092.png",
        "timestamp": 1622119137451,
        "duration": 65
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11300,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006b00a1-00cd-00b9-00fd-00ae009e0031.png",
        "timestamp": 1622119137812,
        "duration": 134
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 11300,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(http://localhost:4200/)\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:23:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622119138204,
        "duration": 2403
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 11300,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: By(css selector, *[id=\"getBtn\"])\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:28:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Check Get Button Message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:27:4)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622119140659,
        "duration": 23
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19596,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d100f4-00ff-000e-001c-00a10015007a.png",
        "timestamp": 1622119160414,
        "duration": 1934
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19596,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fc00e0-00a0-0001-00b1-00ef005100dd.png",
        "timestamp": 1622119162880,
        "duration": 86
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19596,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00410054-00d3-00d1-0091-004b00e200e8.png",
        "timestamp": 1622119163264,
        "duration": 68
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19596,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0002003e-0002-0037-000d-002b001a00cc.png",
        "timestamp": 1622119163571,
        "duration": 56
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 19596,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "NoSuchAlertError: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.switchTo().alert()\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at TargetLocator.alert (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1862:29)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:24:24)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00db0002-00b3-00c9-0003-000700b900ac.png",
        "timestamp": 1622119163872,
        "duration": 2556
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19596,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007f0082-0063-00c8-0008-00050019002c.png",
        "timestamp": 1622119166629,
        "duration": 265
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 25100,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d6001f-0029-00b8-0093-007800c20088.png",
        "timestamp": 1622119191601,
        "duration": 1866
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 25100,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004c00f1-0030-008d-00c0-003a00760031.png",
        "timestamp": 1622119193907,
        "duration": 116
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 25100,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004f006a-00d9-0002-00be-008d00a900d4.png",
        "timestamp": 1622119194271,
        "duration": 63
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 25100,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00050022-0046-00e9-00da-001200330075.png",
        "timestamp": 1622119194561,
        "duration": 60
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 25100,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "NoSuchAlertError: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.switchTo().alert()\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at TargetLocator.alert (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1862:29)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:24:24)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "0074004b-004d-004d-000a-00350058000b.png",
        "timestamp": 1622119194851,
        "duration": 2590
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 25100,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006c009a-0033-0078-003f-007300e4006a.png",
        "timestamp": 1622119197695,
        "duration": 288
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6296,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ba0004-00fb-005a-0026-00dc006f009d.png",
        "timestamp": 1622119231723,
        "duration": 1526
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6296,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006c00f6-002f-0095-0077-00cc00010038.png",
        "timestamp": 1622119233619,
        "duration": 64
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6296,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ae003e-00eb-00c4-00db-007900cc008f.png",
        "timestamp": 1622119233936,
        "duration": 57
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6296,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c10098-0092-0016-00b7-005100ce0020.png",
        "timestamp": 1622119234176,
        "duration": 47
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 6296,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(http://localhost:4200/)\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:23:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622119234411,
        "duration": 2208
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 6296,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: By(css selector, *[id=\"getBtn\"])\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:28:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Check Get Button Message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:27:4)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622119236679,
        "duration": 17
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11412,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00920087-0025-009e-000d-00b10025002c.png",
        "timestamp": 1622119252056,
        "duration": 1992
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11412,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f90066-0054-0041-0075-008c00420097.png",
        "timestamp": 1622119254527,
        "duration": 89
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11412,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002000cc-00c6-0076-00ed-008700a50055.png",
        "timestamp": 1622119254873,
        "duration": 102
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11412,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c50082-009f-0059-005d-000e00310049.png",
        "timestamp": 1622119255243,
        "duration": 85
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 11412,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "NoSuchAlertError: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.switchTo().alert()\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at TargetLocator.alert (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1862:29)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:24:24)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00d000fe-000a-0023-0043-003a00ef0012.png",
        "timestamp": 1622119255646,
        "duration": 661
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11412,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00580057-0020-00b8-001f-002c004600da.png",
        "timestamp": 1622119256581,
        "duration": 214
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22428,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000b00cd-00c3-00a1-0039-00ac00dd00f4.png",
        "timestamp": 1622119299721,
        "duration": 1607
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22428,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00630084-00ef-0021-00b0-000e00260024.png",
        "timestamp": 1622119301993,
        "duration": 84
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22428,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0018002a-009d-00af-0050-007a0006007f.png",
        "timestamp": 1622119302350,
        "duration": 106
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22428,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f900ec-00ae-0082-0086-00e00071008c.png",
        "timestamp": 1622119302714,
        "duration": 68
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 22428,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(http://localhost:4200/)\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:23:26)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622119303027,
        "duration": 2291
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 22428,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: By(css selector, *[id=\"getBtn\"])\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:28:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Check Get Button Message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:27:4)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622119305390,
        "duration": 37
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21012,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00a600b9-002e-004a-00df-00f300200014.png",
        "timestamp": 1622119323124,
        "duration": 1234
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21012,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d400a5-0093-0063-0035-00ea001200d2.png",
        "timestamp": 1622119324772,
        "duration": 61
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21012,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006a00ec-00c8-0084-0054-00c50035003c.png",
        "timestamp": 1622119325036,
        "duration": 54
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21012,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f70052-002b-005f-00ba-0006006200e2.png",
        "timestamp": 1622119325274,
        "duration": 46
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 21012,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "NoSuchAlertError: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.switchTo().alert()\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at TargetLocator.alert (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1862:29)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:24:30)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "006f00ee-009a-003f-00d9-005600f5002a.png",
        "timestamp": 1622119325553,
        "duration": 514
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21012,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004c00a3-0093-00a7-00eb-0066004d002a.png",
        "timestamp": 1622119326316,
        "duration": 226
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22428,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00440094-0067-009d-003d-00470099004a.png",
        "timestamp": 1622119366866,
        "duration": 1514
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22428,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c90097-0038-00d6-0031-008400ac005c.png",
        "timestamp": 1622119368831,
        "duration": 73
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22428,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00da000e-0052-006b-006f-003f004200ae.png",
        "timestamp": 1622119369124,
        "duration": 50
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22428,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006a006f-008f-004f-0049-00b2008e0057.png",
        "timestamp": 1622119369374,
        "duration": 49
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 22428,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "NoSuchAlertError: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.switchTo().alert()\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at TargetLocator.alert (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1862:29)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:25:30)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00fe002d-00d4-00ba-0039-00b50029004d.png",
        "timestamp": 1622119369663,
        "duration": 435
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22428,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0030003a-001d-0021-008a-0073007000cc.png",
        "timestamp": 1622119370332,
        "duration": 169
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26524,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0029003c-006e-006c-0071-0077005800f3.png",
        "timestamp": 1622119398892,
        "duration": 1631
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26524,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007e009c-0006-00af-0039-0008009d00a7.png",
        "timestamp": 1622119400997,
        "duration": 77
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26524,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008e006d-001b-002d-0005-006b001e0034.png",
        "timestamp": 1622119401408,
        "duration": 101
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26524,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005e009e-00fd-00ee-00a3-009600ac00f8.png",
        "timestamp": 1622119401773,
        "duration": 64
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26524,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007a00a8-00f6-0005-0085-00f600f300a1.png",
        "timestamp": 1622119402073,
        "duration": 299
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26524,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008b005e-0055-00dd-00d4-009700e500d4.png",
        "timestamp": 1622119402941,
        "duration": 200
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26028,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00a900f1-00f9-008d-00dc-001f00bc00c8.png",
        "timestamp": 1622119419439,
        "duration": 1157
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26028,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00010045-0058-005c-00c3-0062009c0053.png",
        "timestamp": 1622119421018,
        "duration": 72
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26028,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000300d9-0043-0032-003a-0024002a008e.png",
        "timestamp": 1622119421307,
        "duration": 55
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26028,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001d0036-0096-000b-00df-008e00eb00bc.png",
        "timestamp": 1622119421583,
        "duration": 51
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 26028,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "NoSuchAlertError: no such alert\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.switchTo().alert()\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at TargetLocator.alert (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1862:29)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:25:25)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00290000-00db-0043-003e-00bc00cd00f9.png",
        "timestamp": 1622119421825,
        "duration": 446
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26028,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003f0072-0032-0001-00c5-006a0076003d.png",
        "timestamp": 1622119422473,
        "duration": 130
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18676,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007f0010-00fe-0036-00e1-00df006c009f.png",
        "timestamp": 1622119506951,
        "duration": 2154
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18676,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005c005f-00e7-00f5-0090-003e006a005a.png",
        "timestamp": 1622119509534,
        "duration": 85
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18676,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d10099-0006-007d-002b-00b700780098.png",
        "timestamp": 1622119509846,
        "duration": 50
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18676,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00300052-005c-00b2-0085-009d00270081.png",
        "timestamp": 1622119510126,
        "duration": 51
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18676,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "timestamp": 1622119510385,
        "duration": 275
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18676,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.findElements(By(css selector, *[id=\"getBtn\"]))\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Driver.findElements (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1048:19)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:159:44\n    at ManagedPromise.invokeCallback_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:29:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Check Get Button Message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:28:4)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622119510793,
        "duration": 63
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12824,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ba0060-009c-0062-007d-007500fb0040.png",
        "timestamp": 1622119524043,
        "duration": 1712
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12824,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0004000d-00ba-006a-000d-001000f00008.png",
        "timestamp": 1622119526298,
        "duration": 108
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12824,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0085004b-0027-00fc-00e2-0040008100a3.png",
        "timestamp": 1622119526704,
        "duration": 81
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12824,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00760007-0077-002d-0092-00850065003f.png",
        "timestamp": 1622119527044,
        "duration": 55
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12824,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c20050-0000-0032-0088-00c400b60003.png",
        "timestamp": 1622119527354,
        "duration": 443
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 12824,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f20037-0048-007a-00fd-0046003000f8.png",
        "timestamp": 1622119528014,
        "duration": 131
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10220,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000c00cd-0061-0077-001d-003900f90055.png",
        "timestamp": 1622119545423,
        "duration": 1531
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10220,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00950025-0040-001d-002b-001f00e7008a.png",
        "timestamp": 1622119547477,
        "duration": 82
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10220,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003800ce-00bd-009d-001c-008700170040.png",
        "timestamp": 1622119547802,
        "duration": 61
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10220,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0059006a-00a5-00aa-000d-000c003600ff.png",
        "timestamp": 1622119548124,
        "duration": 58
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10220,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00460040-004f-0030-003c-00b90086005f.png",
        "timestamp": 1622119548395,
        "duration": 425
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10220,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007a00c2-00a8-00d6-0082-00db00b6008f.png",
        "timestamp": 1622119549024,
        "duration": 131
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5836,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00740039-0059-0093-0033-004800a200cb.png",
        "timestamp": 1622119573427,
        "duration": 1195
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5836,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e500d5-0019-0064-0015-0033008a0030.png",
        "timestamp": 1622119575066,
        "duration": 83
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5836,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fc004c-0004-0067-0068-000a006900e3.png",
        "timestamp": 1622119575366,
        "duration": 53
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5836,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009200d6-0077-0069-00bc-00d100bb00a3.png",
        "timestamp": 1622119575625,
        "duration": 52
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5836,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e100e4-00b3-0049-0019-005500b700c9.png",
        "timestamp": 1622119575894,
        "duration": 547
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 5836,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009e009e-0099-0036-0078-00d40057002b.png",
        "timestamp": 1622119576679,
        "duration": 171
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3472,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007700cc-0061-00ef-00e6-0066006800ee.png",
        "timestamp": 1622119614857,
        "duration": 1400
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3472,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a2008d-0057-006a-004c-00e5006c00f0.png",
        "timestamp": 1622119616793,
        "duration": 78
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3472,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009e00ca-00ce-00ba-008b-00bd003d0087.png",
        "timestamp": 1622119617135,
        "duration": 57
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3472,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000000b9-009e-0055-00c0-00e7000d0013.png",
        "timestamp": 1622119617456,
        "duration": 70
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3472,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00060038-0099-00a3-00aa-00a200690033.png",
        "timestamp": 1622119617718,
        "duration": 413
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3472,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00100024-0043-00f3-006b-006f00b30036.png",
        "timestamp": 1622119618349,
        "duration": 277
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21528,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001a008a-003b-0090-0008-009300500033.png",
        "timestamp": 1622119629514,
        "duration": 1178
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21528,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f0004d-0048-0052-000e-00ab00a40026.png",
        "timestamp": 1622119631185,
        "duration": 105
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21528,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00290073-0019-00fc-0046-000900190029.png",
        "timestamp": 1622119631552,
        "duration": 64
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21528,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0055005c-00ed-0049-000e-0003002000e3.png",
        "timestamp": 1622119631877,
        "duration": 71
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21528,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007f0007-009e-005d-00af-00f100600028.png",
        "timestamp": 1622119632161,
        "duration": 472
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21528,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00310067-0013-0045-0063-00a2007d006b.png",
        "timestamp": 1622119632842,
        "duration": 258
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26648,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004800f4-0078-00f7-00a0-0025007b0060.png",
        "timestamp": 1622119657226,
        "duration": 1649
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26648,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006700fa-00a5-0098-00a5-000e00a00035.png",
        "timestamp": 1622119659379,
        "duration": 84
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26648,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000600f3-0046-00ef-00cd-0059000a00b3.png",
        "timestamp": 1622119659714,
        "duration": 72
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 26648,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e500b3-001f-0095-0041-008e00be0071.png",
        "timestamp": 1622119659975,
        "duration": 49
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 26648,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(http://localhost:4200/)\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at Driver.get (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:24:21)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Checking Send Button Functional\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:19:3)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622119660207,
        "duration": 2199
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 26648,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Data Sent}\n  (Session info: chrome=90.0.4430.212)\n  (Driver info: chromedriver=90.0.4430.24 (4c6d850f087da467d926e8eddb76550aed655991-refs/branch-heads/4430@{#429}),platform=Windows NT 10.0.19042 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:553:13)\n    at parseHttpResponse (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: By(css selector, *[id=\"getBtn\"])\n    at Driver.schedule (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:29:13)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Check Get Button Message\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:28:4)\n    at addSpecsToSuite (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\I524894\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\I524894\\Documents\\GitHub\\devopsdemo\\src\\app\\example_spec.js:6:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "timestamp": 1622119662470,
        "duration": 18
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8328,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00190064-00c1-00c5-000f-0077004900d6.png",
        "timestamp": 1622119695527,
        "duration": 1567
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8328,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0037008a-00f4-00b3-00a3-0006006000b9.png",
        "timestamp": 1622119697669,
        "duration": 85
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8328,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bc00c2-00cc-00dc-006f-001f00ab005a.png",
        "timestamp": 1622119698032,
        "duration": 67
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8328,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00de0063-007d-00b6-005e-00bc007700e7.png",
        "timestamp": 1622119698361,
        "duration": 53
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8328,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c8009b-001f-00a6-003b-005c002e0091.png",
        "timestamp": 1622119698618,
        "duration": 472
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8328,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e200f0-00f7-00bf-00f1-00e7005f0011.png",
        "timestamp": 1622119699337,
        "duration": 273
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13744,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e9000a-0018-0029-0008-00cb00a90023.png",
        "timestamp": 1622119784336,
        "duration": 1582
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13744,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002b00df-00f0-00bf-0007-0085008a002b.png",
        "timestamp": 1622119786324,
        "duration": 82
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13744,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00140003-004e-00d7-0057-00e2004d00e8.png",
        "timestamp": 1622119786625,
        "duration": 67
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13744,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00da0070-00f6-00c0-00aa-001100ea00ad.png",
        "timestamp": 1622119786927,
        "duration": 60
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13744,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004100d1-0091-009d-0054-00ec009600b6.png",
        "timestamp": 1622119787287,
        "duration": 2299
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13744,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d90018-00d8-00ec-006f-008f00c300c9.png",
        "timestamp": 1622119789829,
        "duration": 271
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17652,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c20083-00e6-0040-00ba-001c001e009f.png",
        "timestamp": 1622119804213,
        "duration": 1495
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17652,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0026001c-00aa-0085-002e-00e900a3001a.png",
        "timestamp": 1622119806319,
        "duration": 194
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17652,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ba0009-00fb-0006-0045-003d00830054.png",
        "timestamp": 1622119806853,
        "duration": 104
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17652,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ca0075-00ee-008b-007a-008c00cc0064.png",
        "timestamp": 1622119807249,
        "duration": 108
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17652,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009100ec-00d8-00c7-00bc-00ca00eb0009.png",
        "timestamp": 1622119807616,
        "duration": 2364
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17652,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007500c4-00ec-0017-00a4-00e4001c007c.png",
        "timestamp": 1622119810185,
        "duration": 260
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21260,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008e0080-0055-007d-00b0-0031002800a6.png",
        "timestamp": 1622119818469,
        "duration": 1403
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21260,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00730054-00eb-00ab-00d1-0069005100c1.png",
        "timestamp": 1622119820284,
        "duration": 65
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21260,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001e00c5-00a6-0005-00c4-003c003b005d.png",
        "timestamp": 1622119820553,
        "duration": 60
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21260,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00af0096-0015-007e-0071-002f00a100b0.png",
        "timestamp": 1622119820825,
        "duration": 55
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21260,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009b0094-005b-00ba-0032-007800370043.png",
        "timestamp": 1622119821144,
        "duration": 2256
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21260,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fa0074-0006-002f-00bb-00ae00490046.png",
        "timestamp": 1622119823625,
        "duration": 229
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22064,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e400ce-0013-0024-00fc-002a004b00a0.png",
        "timestamp": 1622119836043,
        "duration": 1966
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22064,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004d00d5-0010-00ba-0054-00e0005e00fa.png",
        "timestamp": 1622119838617,
        "duration": 100
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22064,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002c00e4-00e1-009c-00af-001c00c40069.png",
        "timestamp": 1622119839043,
        "duration": 80
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22064,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cb0009-0050-00c5-0007-00c3006600f7.png",
        "timestamp": 1622119839421,
        "duration": 76
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22064,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00df00f8-00e5-0075-00ef-003a008700aa.png",
        "timestamp": 1622119839743,
        "duration": 2300
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 22064,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e90041-0008-0035-00d5-003e00700067.png",
        "timestamp": 1622119842390,
        "duration": 248
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1820,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00540032-00c3-002d-0067-008800a40007.png",
        "timestamp": 1622119911566,
        "duration": 1209
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1820,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005800af-00a1-002b-0060-001d002d008f.png",
        "timestamp": 1622119913226,
        "duration": 64
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1820,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d10004-00fc-008a-0080-00810010006e.png",
        "timestamp": 1622119913492,
        "duration": 45
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1820,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002000e3-0019-003d-0078-00f400690044.png",
        "timestamp": 1622119913746,
        "duration": 53
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1820,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00550087-0006-0078-004f-004300ba0057.png",
        "timestamp": 1622119913998,
        "duration": 2267
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 1820,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ab006e-00ba-005a-0014-002400830073.png",
        "timestamp": 1622119916482,
        "duration": 2174
    },
    {
        "description": "Open Local Host|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3384,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b50011-0078-004f-002b-008f00d30071.png",
        "timestamp": 1622119933246,
        "duration": 1938
    },
    {
        "description": "Check Text Field|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3384,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0064009a-003d-00ee-00bc-006200f60058.png",
        "timestamp": 1622119935689,
        "duration": 118
    },
    {
        "description": "Check Send Message Btn|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3384,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ce00e9-000b-0094-0075-003c005400d4.png",
        "timestamp": 1622119936101,
        "duration": 79
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3384,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006800b7-00c8-00b8-009f-00da004e005f.png",
        "timestamp": 1622119936422,
        "duration": 56
    },
    {
        "description": "Checking Send Button Functional|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3384,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00250031-006f-006c-001d-0047000600a6.png",
        "timestamp": 1622119936735,
        "duration": 2279
    },
    {
        "description": "Check Get Button Message|angularjs homepage",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3384,
        "browser": {
            "name": "chrome",
            "version": "90.0.4430.212"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d200cc-0050-0098-0012-007000350070.png",
        "timestamp": 1622119939366,
        "duration": 4254
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
