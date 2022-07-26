// constants
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const REFRESH_RATE = 100;
const FOCUS_COLOUR = "#F26157"
const REST_COLOUR = "#64B6AC"
const NEUTRAL_COLOUR = "#FFD400"
const BG_COLOURS = {
    "focus": FOCUS_COLOUR,
    "rest": REST_COLOUR,
    "neutral": NEUTRAL_COLOUR
}

//event -> type, time, data
const events = {
    START_FOCUS: "start_focus",
    STOP_FOCUS: "stop_focus",
    START_BREAK: "start_break",
    STOP_BREAK: "stop_break",
    FORCE_STOP_FOCUS: "force_stop_work",
    FORCE_STOP_BREAK: "force_stop_break",
    START: ["start_focus", "start_break"],
    STOP: ["stop_focus", "stop_break"],
    FOCUS:["start_focus", "stop_focus"],
    BREAK:["start_break", "stop_break"],
    
}
const sounds = {
    RING: "bell.wav",
    BUTTON: "click.mp3"
}



$(document).ready(() => {
    loadSettings();
    updateSettings();
    loadTasks();
    updateTaskList();
    saveTasks();
    report.loadReport();
})
var $bigButton = $("#stopWatchButton");
var $timeDisplay = $("#time");
var $closeButton = $("#closeButton");
var state = "neutral"; //neutral => focus => rest => neutral 
var stopWatch; //stores current StopWatch object
var countDown; //stores current countdown object
var rest; //stores deserved rest status object
const l = {
    TIMER: "timer",
    STATE: "state",
    TASKS: "task",
    SETTINGS: "settings",
    UI: "UI",
    REPORT: "report",
    ALL: ["timer", "state", "task", "settings", "UI", "report"]
} //logging types

var cheats = {

    //adds ms to stopwatch
    addsw: (ms) => {
        stopWatch._referenceDate -= ms;
    },
    //adds ms to countdown (decreasing time left)
    addcd: (ms) => {
        countDown._referenceDate -= ms
    },

    //start and stop logging info to console
    startLogging: () => {
        cheats.log = true;
    },
    stopLogging: () => {
        cheats.log = false;
    },
    log: false,
    logFilter: [], //filter log to only show certain types of log messages
    //add and remove items from log filter
    filterType: (...args) => {
        cheats.logFilter = cheats.logFilter.concat(args);
    },
    unfilterType: (...args) => {
        cheats.logFilter = cheats.logFilter.filter(x => !args.includes(x));
    },
    purgeLocalStorage: () => {
        localStorage.clear();
    }
}

function log(type, ...args) {
    if (cheats.log && cheats.logFilter.includes(type)) {
        console.log(...args);
    }
}


function calculateRestTime(focusTime) {
    //returns the # of milliseconds user should rest for based on specified method
    //(e.g) method = ratio -> restTime = focusTime / workToRestratio
    var restTime;
    log(l.TIMER, "calculating rest time for focus time: " + focusTime);
    if (settings.restCalculationMethod.method == "ratio") {
        periods = Math.floor(focusTime / 60 / 1000 / settings.restCalculationMethod.minutesOfWork)
        restTime = periods * 60 * 1000 * settings.restCalculationMethod.minutesOfRest;
    }
    return {
        deserving: restTime > 0,
        restTime: restTime
    };
}

function formatTime(sw) {
    //return time formatted as "(m?)mm:ss"
    var minutes = sw.getMinutes() + (sw.getHours() * 60);
    var seconds = sw.getSeconds();
    return (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);
}
//update display with current time
function displayTime(that) {
    $timeDisplay.text(formatTime(that));
}

function updateTitle(that) {
    log(l.STATE, "current state: " + state);
    switch (state) {
        case "focus":
            document.title = formatTime(that) + " - Focusing";
            break;
        case "rest":
            document.title = formatTime(that) + " - Break";
            break;
        case "neutral":
            document.title = "Time to focus";
            break;
    }
}
//change state and update theme accordingly
function changeState(newState) {
    if (newState == "neutral") {
        if (stopWatch != null) {
            stopWatch.stop();
        }
        if (countDown != null) {
            countDown.stop();
        }
    }
    state = newState;
    document.body.style.backgroundColor = BG_COLOURS[state];
    $timeDisplay.text("00:00");
}
//dropdown style notifications 
function notify(message) {
    $(".notify").toggleClass("active");
    $("#notifyType").toggleClass("success");
    $("#notifyType").html(message)
    setTimeout(function () {
        $(".notify").removeClass("active");
        $("#notifyType").removeClass("success");
    }, 2000);
};

function playSound(sound) {
    var audio = new Audio(sound);
    audio.play();
}

function startFocus() {
    report.addEvent(events.START_FOCUS, new Date(), {task: tasks[selectedTask]});
    changeState("focus");
    $bigButton.text("Rest");
    stopWatch = new StopWatch(REFRESH_RATE,
        (that) => {
            displayTime(that);
            updateTitle(that);
            rest = calculateRestTime(that.getTotalMilliseconds());
            $bigButton.text("Rest " + (rest.deserving ? "(" + (rest.restTime / 60 / 1000) + " min)" : ""));
            if (settings.autostartRest && that.getTotalMilliseconds() > settings.autostartRestAfter) {
                report.addEvent(events.STOP_FOCUS, new Date(), {task: tasks[selectedTask]});
                playSound(sounds.RING);
                changeState("rest");
                startRest();
            }
        })
    stopWatch.start()
}

function startRest() {
    report.addEvent(events.START_BREAK, new Date(), {task: tasks[selectedTask]});
    changeState("rest");
    $bigButton.text("Skip");
    stopWatch.stop();
    countDown = new CountDown(rest.restTime, REFRESH_RATE,
        (that) => { //onUpdate
            displayTime(that);
            updateTitle(that);
        },
        () => { //OnFinish\
            playSound(sounds.RING);
            report.addEvent(events.STOP_BREAK, new Date(), {task: tasks[selectedTask]});
            if (settings.autostartFocus) {
                changeState("focus");
                startFocus();
            } else {
                changeState("neutral");
                $bigButton.text("Start");
            }
        })
    countDown.start();
}

function startNeutral() {
    changeState("neutral");
    $bigButton.text("Start");
    countDown.stop()
    updateTitle();
}
$bigButton.click(function () {
    log(l.UI, "stopwatch button clicked");
    playSound(sounds.BUTTON);
    switch (state) {
        case "neutral":
            startFocus()
            break
        case "focus":
            if (!rest.deserving) {
                notify("You have to work for at least " + (settings.restCalculationMethod.minutesOfWork) + " minutes");
                break;
            }
            report.addEvent(events.STOP_FOCUS, new Date(), {task: tasks[selectedTask]});
            startRest();
            break;
        case "rest":
            report.addEvent(events.STOP_BREAK, new Date(), {task: tasks[selectedTask]});
            startNeutral();
            break;
    }
})
$closeButton.click(() => {
    if (state == "neutral") {
        notify("already stopped");
        return;
    }
    if (state == "focus" && rest.deserving && !confirm("discard session?")) {
        return;
    }

    if(state == "rest"){
        report.addEvent(events.FORCE_STOP_BREAK, new Date(), {task: tasks[selectedTask]});
    }else if(state == "focus"){
        report.addEvent(events.FORCE_STOP_FOCUS, new Date(), {task: tasks[selectedTask]});
    }
    $bigButton.text("Start");
    changeState("neutral");
    updateTitle();
})
//second section, task manager
var $taskEntryBox = $("#taskEntryBox")
var $taskEntryForm = $("#taskEntryForm")
var $taskList = $("#taskList")
var tasks = [];
var selectedTask = 0;
$taskEntryForm.submit((that) => {
    log(l.TASKS, "task submitted");
    that.preventDefault();
    var task = $taskEntryBox.val().trim();
    if (task == "") {
        notify("Task cannot be empty");
        return;
    }
    addTask(task);
    updateTaskList();
    $taskEntryBox.val("");
})

function addTask(task) {
    tasks.push(task);
    saveTasks();
}

function updateTaskList() {
    //render
    $taskList.html("");
    tasks.forEach((task, index) => {
        $taskList.append(getTaskHTML(task, index));
    })
    if (selectedTask != -1) {
        $taskList.children().eq(selectedTask).addClass("text-white bg-dark");
    }
}

function getTaskHTML(task, index) {
    return `<li class="card  rounded-right mb-1 p-0 border-0 " data-index = "${index}"><div class="d-inline-flex"><btn class = "unselectable bg-dark rounded-left" onClick="selectTaskAt(${index})">&nbsp;&nbsp;&nbsp;&nbsp;</btn><span class = "m-3"><btn class="task-text task-item" onClick="removeTaskAt(${index})"> ${task}</btn></span></div></li>`
}

function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
    localStorage.setItem("selectedTask", selectedTask!= null ? selectedTask : 0);
}

function loadTasks() {
    var tasks = JSON.parse(localStorage.getItem("tasks"));
    if (tasks) {
        tasks.forEach((task) => {
            addTask(task);
        })
    }
    selectedTask = localStorage.getItem("selectedTask");
    updateTaskList();
}

function removeTaskAt(index) {
    log(l.TASKS, "removing task at index: " + index);
    tasks.splice(index, 1);
    updateTaskList();
    saveTasks();
}

function selectTaskAt(index) {
    if (index == 0) {
        return;
    }
    log(l.TASKS, "selecting task at index: " + index);
    tasks.unshift(tasks.splice(index, 1));
    updateTaskList();
    saveTasks();
}

//settings manager
var settings = {
    autostartFocus: false,
    autostartRestAfter: 25 * MIN, //25 minutes, default for pomodoro
    autostartRest: false,
    restCalculationMethod: {
        method: "ratio",
        minutesOfWork: 5,
        minutesOfRest: 1,
        workToRestRatio: 5,
    },
    dev: false,
    devOptions: {
        log: false,
        logFilter: l.ALL,
    }
}

var $settingsElements = {
    autostartFocus: $("#autostartFocusSwitch"),
    autostartRest: $("#autostartRestSwitch"),
    autostartFocusAfter: $("#autostartFocusAfterInput"),
    minutesOfWork: $("#minutesOfWorkInput"),
    minutesOfRest: $("#minutesOfRestInput"),
    devOptions: $("#devOptions"),
    loggingSwitch: $("#loggingSwitch"),
    loggingTypes: $("#loggingTypes"),
}
log(l.SETTINGS, "settings", $settingsElements);


function loadSettings() {
    //load settings from local storage
    // if empty do nothing
    var loadedSettings = JSON.parse(localStorage.getItem("settings"));
    log(l.SETTINGS, "loaded settings: " + loadedSettings);
    // set cheats
    if (loadedSettings) {
        settings = loadedSettings
    }
    if (settings.dev) {
        cheats.log = settings.devOptions.log;
        cheats.logFilter = settings.devOptions.logFilter;
        Date.showUi()
    }
}

function saveSettings() {
    // load settings from elements
    settings.autostartFocus = $settingsElements.autostartFocus.is(":checked");
    settings.autostartRest = $settingsElements.autostartRest.is(":checked");
    settings.restCalculationMethod.minutesOfRest = parseInt($settingsElements.minutesOfRest.val());
    settings.restCalculationMethod.minutesOfWork = parseInt($settingsElements.minutesOfWork.val());
    settings.restCalculationMethod.workToRestRatio = settings.restCalculationMethod.minutesOfWork / settings.restCalculationMethod.minutesOfRest;
    settings.autostartRestAfter = parseInt($settingsElements.autostartFocusAfter.val()) * 60 * 1000;
    settings.devOptions.log = $settingsElements.loggingSwitch.is(":checked");
    log(l.SETTINGS, $settingsElements.loggingSwitch.is(":checked"));
    //save logging types
    var loggingTypes = [];
    for (var i = 0; i < l.ALL.length; i++) {
        log(l.SETTINGS, $settingsElements.loggingTypes.children().eq(i).text().trim());
        if ($(`#${l.ALL[i]}LoggingType`).is(":checked")) {
            log(l.SETTINGS, "checked");
            loggingTypes.push(l.ALL[i])
        };
    }
    settings.devOptions.logFilter = loggingTypes;
    //save settings to local storage
    localStorage.setItem("settings", JSON.stringify(settings));
}

function updateSettings() {
    //TODO ->  more terse way?
    $settingsElements.autostartFocus.prop("checked", settings.autostartFocus);
    $settingsElements.autostartRest.prop("checked", settings.autostartRest);
    $settingsElements.minutesOfWork.val(settings.restCalculationMethod.minutesOfWork);
    $settingsElements.minutesOfRest.val(settings.restCalculationMethod.minutesOfRest);
    $settingsElements.autostartFocusAfter.val(settings.autostartRestAfter / 60 / 1000);
    $settingsElements.loggingSwitch.prop("checked", settings.devOptions.log);
    $settingsElements.loggingTypes.html("")

    if (settings.dev) {
        for (var i = 0; i < l.ALL.length; i++) {
            //append checkbox with label
            $settingsElements.loggingTypes.append(
                `<div class="form-check text-light">
                <input class="form-check-input" type="checkbox" value="" id="${l.ALL[i]}LoggingType" ${settings.devOptions.logFilter.includes(l.ALL[i]) ? "checked" : "unchecked"}>
                <label class="form-check-label" for="${l.ALL[i]}LoggingType">
                  ${l.ALL[i]}
                </label>
              </div>`
            );
        }
        $settingsElements.devOptions.show();
        if (settings.devOptions.log) {
            $settingsElements.loggingTypes.show();
        } else {
            $settingsElements.loggingTypes.hide();
        }
    } else {
        $settingsElements.devOptions.hide();
    }
    log(l.SETTINGS, "drawing settings: " + JSON.stringify(settings));
}

$optionsButton = $("#navbarOptionsButton");
$optionsButton.click(() => {
    loadSettings();
})
$saveOptionsButton = $("#saveOptionsButton");
$saveOptionsButton.click(() => {
    if (state != "neutral" && !confirm("refresh page?, you will lose your current session")) {
        return;
    }
    saveSettings();
    location.reload();
})
$purgeLocalStorageButton = $("#purgeLocalStorageButton");
$purgeLocalStorageButton.click(() => {
    localStorage.clear();
    location.reload();
})
$optionsTitle = $("#optionsModalTitle");
var timesClicked = 0;
$optionsTitle.click(() => {
    log(l.SETTINGS, "clicked options title");
    if (settings.dev) {
        log(l.SETTINGS, "already in dev mode");
        notify("Already in devMode");
        return;
    }
    timesClicked++;
    if (timesClicked == 5) {

        settings.dev = true;
        updateSettings();
        log(l.SETTINGS, "entered dev mode");
        timesClicked = 0;
    }

})
//when logging switch is enabled , show logging types
$settingsElements.loggingSwitch.change(() => {
    if ($settingsElements.loggingSwitch.is(":checked")) {
        $settingsElements.loggingTypes.show();
    } else {
        $settingsElements.loggingTypes.hide();
    }
})

//report modal
$reportButton = $("#navbarReportButton");
$reportElements = {
    focusTimeText : $("#reportFocusTime"),
    restTimeText : $("#reportRestTime"),
}
$reportButton.click(() => {
    log(l.REPORT, "clicked report button");
    focusTime = report.ofType(...events.FOCUS).totalDuration()
    restTime = report.ofType(...events.BREAK).totalDuration()
    log(l.REPORT, "focusTime: " + focusTime + " restTime: " + restTime);
    //update report elements
    $reportElements.focusTimeText.text(`${Math.ceil(focusTime / MIN)} min`);
    $reportElements.restTimeText.text(`${Math.ceil(restTime / MIN)} min`);
})


// helper class for stopwatch 
// technically a FSM
class StopWatch {
    constructor( updateDelay = 200, onUpdateCallback = () => { }) {
        this._time = 0 //# of milliseconds on stopwatch
        this._referenceDate; //PRIVATE date at which stopwatch STARTS 
        this._state = "stopped" // "stopped" - "running" - "paused"
        this._updateInterval; //interval object for starting and stopping stopwatch
        this._updateDelay = updateDelay; //set delay for updating stopwatch
        this._onUpdateCallback = onUpdateCallback; //custom callback function for stopwatch updates
        
    }
    // start stopwatch from 00:00:00 
    // transition : "stopped" -> "paused"
    start() {
        if (this._state == "stopped") {
            this._state = "running";
            this._initReferenceDate();
            this._updateInterval = setInterval(() => {
                this._advance()
            }, this._updateDelay);
        }
    }
    // stop stopwatch and reset to 0 
    // transition : "any" -> "stopped"
    stop() {
        this._state = "stopped";
        clearInterval(this._updateInterval);

        this.reset()
    }
    // pause without resetting time 
    // transition : "running" -> "paused"
    pause() {
        if (this._state == "running") {
            this._state = "paused";
            log(l.TIMER, "paused at: " + this._time);
            log(l.TIMER, "pause reference: " + this._referenceDate);
            clearInterval(this._updateInterval);
        }
    }
    //resume from paused time 
    // transition : "paused" -> "running"
    resume() {
        if (this._state == "paused") {
            this._state = "running";
            this._shiftReferenceDate(this._time);
            this._updateInterval = setInterval(() => {
                this._advance()
            }, this._updateDelay)
        }
    }
    reset() {
        this._time = 0;
    }
    //raw value of time in several units
    getTotalMilliseconds() {
        return this._time;
    }
    getTotalSeconds() {
        return Math.floor(this.getTotalMilliseconds() / 1000);
    }
    getTotalMinutes() {
        return Math.floor(this.getTotalSeconds() / 60);
    }
    getTotalHours() {
        return Math.floor(this.getTotalMinutes() / 60);
    }
    //get component of time constrained to certain unit's definition
    getSeconds() {
        return this.getTotalSeconds() % 60;
    }
    getMinutes() {
        return this.getTotalMinutes() % 60;
    }
    getHours() {
        return this.getTotalHours() % 24;
    }
    //set a custom callback functions (e.g updating UI based on stopwatch time)
    releaseOnUpdateCallback() {
        this._onUpdateCallback = () => { };
    }
    //set a callback which is called everytime stopwatch time is updated
    //callback recieves stopWatch object as argument
    setOnUpdateCallback(fun) {
        this._onUpdateCallback = fun;
    }
    reset() {
        this._time = 0;
    }
    //this adds time to the stopwatch by shifting the reference date backwards
    _shiftReferenceDate(time) {
        this._referenceDate = Date.now() - time;
    }
    _initReferenceDate() {
        this._referenceDate = Date.now();
    }
    _advance() {
        this._time = (Date.now() - this._referenceDate);
        this._onUpdateCallback(this) //invoke custom callback, passing stopwatch object as argument
        log(l.TIMER, this._time);
    }
}
class CountDown extends StopWatch {
    constructor(duration, updateDelay = 200, onUpdateCallback = () => { }, onFinishedCallback = () => { }) {
        super(updateDelay, onUpdateCallback);
        this._referenceDate = Date.now() + duration; //Date at which countdown ENDS
        this._time = duration; //time REMAINING in countdown
        this._duration = duration;
        this._onFinishedCallback = onFinishedCallback;
    }
    //override _advance with the following:
    //time starts at duration and decreases to 0
    //once time reaches 0, countdown is stopped and onFinishedCallback is invoked
    _advance() {
        this._time = (this._referenceDate - Date.now());
        log(l.TIMER, "countdown left: " + this._time);
        if (this._time <= 0) {
            this._onFinish()
        }
        this._onUpdateCallback(this) //invoke custom callback, passing CountDown object as argument
    }
    //adds time to countdown by shifting the reference date forwards (since we are counting up to reference date)
    _shiftReferenceDate(shift) {
        log(l.TIMER, "shifting ref forward")
        this._referenceDate = Date.now() + shift;
    }
    _initReferenceDate() {
        this._referenceDate = Date.now() + this._duration;
    }
    _onFinish() {
        this.stop()
        this.state = "finished"
        this._time = 0;
        this._onFinishedCallback(this)
    }
    reset() {
        this._time = this._duration
    }
    setOnFinishedCallback(fun) {
        this._onFinishedCallback = fun;
    }
    releaseOnFinishedCallback() {
        this._onFinishedCallback = () => { };
    }
}


//helper class for creating, parsing, and displaying reports
class Report {
    constructor(events = [],localStorageKey = "report",__primary = true) {
        this.__primary = __primary;; 
        this._events = events
        this._key = localStorageKey
    }
    addEvent(type, time = Date.now(), data = {}) {
        this._events.push(new ReportEvent(type, time, data))
        log(l.REPORT, "added event: " + type + " at " + time)
        if (this.__primary){
            this.saveReport()
        }
    }
    ofType(...types) {
        return new Report(this._events.filter(e => types.includes(e.type)), this._key,false)
    }
    between(start, end) {
        return new Report(this._events.filter(e => e.time >= start && e.time <= end), this._key,false)
    }
    getDurationPairs() {
        //returns an array of durations for each pair of events (Start and End)
        let durations = []
        for (let i = 0; i < this._events.length; i++) {
            log(l.REPORT, "event type: " + this._events[i].type)
            if (events.STOP.includes(this._events[i].type)) {
                log(l.REPORT, "found stop event")
                durations.push({
                    start : this._events[i - 1] ,
                    end :  this._events[i] ,
                    duration : this._events[i].time - this._events[i - 1].time})
            }

        }
        return durations;
    }
    getDurationHTML(){
        var durations = this.getDurationPairs()
        var html = ""
        for(var i = 0; i < durations.length; i++){
            html += `<div>${durations[i].start.type} - ${durations[i].end.type} : ${durations[i].duration}</div>`
        }
        return html
    }
    totalDuration(){
        var durations = this.getDurationPairs()
        var total = 0
        for(var i = 0; i < durations.length; i++){
            total += durations[i].duration
        }
        return total
    }
    loadReport(){
        var report = JSON.parse(localStorage.getItem(this._key))
        log(l.REPORT, "loaded report: " + report)
        if (report){
            this._events = report._events
            log(l.REPORT, "loaded events: " + this._events)
        }
    }
    saveReport(){
        localStorage.setItem(this._key, JSON.stringify(this))
        log(l.REPORT, "saved report: ", this)
    }
}

class ReportEvent {
    constructor(type, time, data) {
        this.type = type
        this.time = time  - 0 //TODO : surely a better way to do this
        this.data = data
        this._timestamp = new Date(this.time).toLocaleString();
    }

}

var report = new Report([],"report");