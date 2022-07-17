// constants
const SPEED = 1;
const REFRESH_RATE = 100;
const FOCUS_COLOUR = "#F26157"
const REST_COLOUR = "#64B6AC"
const NEUTRAL_COLOUR = "#FFD400"
const BG_COLOURS = {
    "focus": FOCUS_COLOUR,
    "rest": REST_COLOUR,
    "neutral": NEUTRAL_COLOUR
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
})
var $bigButton = $("#stopWatchButton");
var $timeDisplay = $("#time");
var $closeButton = $("#closeButton");
var state = "neutral"; //neutral => focus => rest => neutral 
var stopWatch; //stores current StopWatch object
var countDown; //stores current countdown object
var rest; //stores deserved rest status object

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
    log: false
}

function log(...args) {
    if (cheats.log) {
        console.log(...args);
    }
}

function calculateRestTime(focusTime) {
    //returns the # of milliseconds user should rest for based on specified method
    //(e.g) method = ratio -> restTime = focusTime / workToRestratio
    var restTime;
    log("calculating rest time for focus time: " + focusTime);
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
    log("current state: " + state);
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
    changeState("focus");
    $bigButton.text("Rest");
    stopWatch = new StopWatch(SPEED, REFRESH_RATE,
        (that) => {
            displayTime(that);
            updateTitle(that);
            rest = calculateRestTime(that.getTotalMilliseconds());
            $bigButton.text("Rest " + (rest.deserving ? "(" + (rest.restTime / 60 / 1000) + " min)" : ""));
            if (settings.autostartRest && that.getTotalMilliseconds() > settings.autostartRestAfter) {
                playSound(sounds.RING);
                changeState("rest");
                startRest();
            }
        })
    stopWatch.start()
}

function startRest() {
    changeState("rest");
    $bigButton.text("Skip");
    stopWatch.stop();
    countDown = new CountDown(rest.restTime, 1, REFRESH_RATE,
        (that) => { //onUpdate
            displayTime(that);
            updateTitle(that);
        },
        () => { //OnFinish
            playSound(sounds.RING);
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
    log("stopwatch button clicked");
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
            startRest();
            break;
        case "rest":
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
    log("task submitted");
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
        $taskList.append(getHTML(task, index));
    })
    if (selectedTask != -1) {
        $taskList.children().eq(selectedTask).addClass("text-white bg-dark");
    }
}

function getHTML(task, index) {
    return `<li class="card  rounded-right mb-1 p-0 border-0 " data-index = "${index}"><div class="d-inline-flex"><btn class = "bg-dark rounded-left" onClick="selectTaskAt(${index})">&nbsp;&nbsp;&nbsp;&nbsp;</btn><span class = "m-3"><btn class="task-text task-item" onClick="removeTaskAt(${index})"> ${task}</btn></span></div></li>`
}

function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
    localStorage.setItem("selectedTask", selectedTask);
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
    log("removing task at index: " + index);
    tasks.splice(index, 1);
    updateTaskList();
    saveTasks();
}

function selectTaskAt(index) {
    if (index == 0) {
        return;
    }
    log("selecting task at index: " + index);
    tasks.unshift(tasks.splice(index, 1));
    updateTaskList();
    saveTasks();
}

//settings manager
var settings = {
    autostartFocus: false,
    autostartRestAfter: 25 * 60 * 1000, //25 minutes, default for pomodoro
    autostartRest: false,
    restCalculationMethod: {
        method: "ratio",
        minutesOfWork: 5,
        minutesOfRest: 1,
        workToRestRatio: 5,
    }
}
$optionsButton = $("#navbarOptionsButton");
$optionsButton.click(() => {
    loadSettings();
})
$saveOptionsButton = $("#saveOptionsButton");
$saveOptionsButton.click(() => {
    saveSettings();
})
var $settingsElements = {
    autostartFocus: $("#autostartFocusSwitch"),
    autostartRest: $("#autostartRestSwitch"),
    autostartFocusAfter: $("#autostartFocusAfterInput"),
    minutesOfWork: $("#minutesOfWorkInput"),
    minutesOfRest: $("#minutesOfRestInput"),
}
log($settingsElements);

function loadSettings() {
    //load settings from local storage
    // if empty do nothing
    var loadedSettings = JSON.parse(localStorage.getItem("settings"));
    log("loaded settings: " + JSON.stringify(loadedSettings));
    if (loadedSettings) {
        settings = loadedSettings
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
    log("saving settings: " + JSON.stringify(settings));
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
    log("drawing settings: " + JSON.stringify(settings));
}



// helper class for stopwatch 
// technically a FSM
class StopWatch {
    constructor(speed = 1, updateDelay = 200, onUpdateCallback = () => { }) {
        this._time = 0 //# of milliseconds on stopwatch
        this._referenceDate; //PRIVATE date at which stopwatch STARTS 
        this._state = "stopped" // "stopped" - "running" - "paused"
        this._updateInterval; //interval object for starting and stopping stopwatch
        this._updateDelay = updateDelay; //set delay for updating stopwatch
        this._onUpdateCallback = onUpdateCallback; //custom callback function for stopwatch updates
        this._speed = speed; //used to speed up stopwatch for debugging
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
            log("paused at: " + this._time);
            log("pause reference: " + this._referenceDate);
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
        this._time = (Date.now() - this._referenceDate) * this._speed;
        this._onUpdateCallback(this) //invoke custom callback, passing stopwatch object as argument
        log(this._time);
    }
}
class CountDown extends StopWatch {
    constructor(duration, speed = 1, updateDelay = 200, onUpdateCallback = () => { }, onFinishedCallback = () => { }) {
        super(speed, updateDelay, onUpdateCallback);
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
        log("countdown left: " + this._time);
        if (this._time <= 0) {
            this._onFinish()
        }
        this._onUpdateCallback(this) //invoke custom callback, passing CountDown object as argument
    }
    //adds time to countdown by shifting the reference date forwards (since we are counting up to reference date)
    _shiftReferenceDate(shift) {
        log("shifting ref forward")
        this._referenceDate = Date.now() + shift;
    }
    _initReferenceDate() {
        this._referenceDate = Date.now() + this._duration;
    }
    _onFinish() {
        this.stop()
        this.state = "finished"
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

