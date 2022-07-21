//check localStorage for  current version, and if it's different, clear localStorage and rewrite version

const localStorageVersion = "DEBUG_OPTIONS_VERSION11"; 
if (localStorage.getItem("version") !== localStorageVersion) {
    console.log("updated from ",localStorage.getItem("version")," to " ,localStorageVersion);
    localStorage.clear();
    localStorage.setItem("version", localStorageVersion);
    location.reload();
}