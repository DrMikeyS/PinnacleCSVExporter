function extractTheListString(fullpagestring) {
    var start = fullpagestring.indexOf("User  	Status") + 16;
    var end = fullpagestring.indexOf("EULA");
    return fullpagestring.slice(start, end);
}

function extractSingleRecordToArray(str) {
    savedLoc = str.indexOf("Saved ");
    if (savedLoc > 0) {
        str = str.slice(0, savedLoc - 1) + str.slice(18 + savedLoc);
    }
    res = str.replace("COVID Vaccine - 2020/21", "");
    res = res.replace("COVID-19 Vaccination", "");
    res = res.replaceAll("• ", "");
    res = res.replace(/(\u2022 )/g, '');
    res = res.replace("\nClick to ", "");
    res = res.replaceAll("		", "\n");
    res = res.replace("Vaccination	", "Vaccination\n");
    res = res.replace("	Cancelled\n", "\nCancelled");
    res = res.replace("	Completed\n", "\nCompleted");
    res = res.replace("	Pending\nawaiting completion\n", "\nPending");
    res = res.replaceAll("	", "")
    resArray = res.split("\n")

    //Insert blank field if cancelled or pending
    containsVaccinationString = res.indexOf("Vaccination");
    if (containsVaccinationString === -1) {
    	resArray.splice(5, 0, "");
    }

    //Sort random middle field
 if(resArray[4].length>12){ //ie longer than a postcode should be
 	contains1VaccinationString = res.indexOf("First Vaccination");
  contains2VaccinationString = res.indexOf("Second Vaccination");
  vaccinationbit=''
  if (contains1VaccinationString >0) {
  	vaccinationbit = "First Vaccination"
  }else if (contains2VaccinationString >0) {
  	vaccinationbit = "Second Vaccination"
  }    
  resArray.splice(5, 0, vaccinationbit);
 }

    return resArray
}

function convertListToArray(theListString) {
    theListString = theListString.replaceAll("reinstate\n", "");
theListString = theListString.replaceAll("Cancel\n", "");
var theListArray = theListString.split("Click to ")
//removeCancelledList
theListArray.splice(-1, 1)
var finalList = [
["DateOfVaccine", "Name", "DateOfBirth", "NHSNumber", "PostCode", "FirstOrSecond", "Vaccinator", "Status"]
];
theListArray.forEach(function (listItem) {
    finalList.push(extractSingleRecordToArray(listItem));
});
return finalList;
}

function generateCSVString(fullpagestring) {
    var theListString = extractTheListString(fullpagestring);
    var listArray = convertListToArray(theListString);
    return $.csv.fromArrays(listArray);
}

function generateDownloadCSV(csvContent, filename) {
    var blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;'
    });
    var filename = filename + ".csv"
    var link = document.createElement("a");
    var url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function generateTable(obj) {
    var string = '<table class="table" id="stats-table">';
    for (const [key, value] of Object.entries(obj)) {
        string = string + '<tr><td>' + key + '</td><td>' + value + '</td></tr>';
    }
    return string + '</table>';
}

function getPinnacleStats(csvObjects) {
    var stats = {};
    completedObjects = csvObjects.filter(patient => patient.Status == "Completed")
    stats['Completed'] = completedObjects.length;
    stats['First'] = completedObjects.filter(patient => patient.FirstOrSecond == "First Vaccination").length;
    stats['Second'] = completedObjects.filter(patient => patient.FirstOrSecond == "Second Vaccination").length;
    stats['Dec'] = completedObjects.filter(patient => patient.DateOfVaccine.slice(5, 7) == "12").length;
    stats['Jan'] = completedObjects.filter(patient => patient.DateOfVaccine.slice(5, 7) == "01").length;
    stats['Feb'] = completedObjects.filter(patient => patient.DateOfVaccine.slice(5, 7) == "02").length;
    stats['Attended but not given'] = completedObjects.filter(patient => patient.FirstOrSecond == "").length;
    return stats
}



function readCSVFileAndReturnPromise(file) {
    var reader = new FileReader();
    reader.readAsText(file, "UTF-8");
    return new Promise((resolve, reject) => {
        reader.onload = function (event) {
            csvContent = event.target.result;
            resolve($.csv.toObjects(csvContent))
        }
    });
}

function getAccubookStats(csvObjects) {
    var stats = {};
    stats['Arrived'] = csvObjects.filter(patient => patient.Arrived == "True").length;
    stats['NotArrived'] = csvObjects.filter(patient => patient.Arrived == "False").length;
    stats['Dec'] = csvObjects.filter(patient => patient.SessionDate.slice(5, 7) == "12").length;
    stats['Jan'] = csvObjects.filter(patient => patient.SessionDate.slice(5, 7) == "01").length;
    stats['Feb'] = csvObjects.filter(patient => patient.SessionDate.slice(5, 7) == "02").length;
    practicesArray = getUniquePractices(csvObjects);
    for (practice of practicesArray) {
        stats[practice] = csvObjects.filter(patient => patient.RegisteredPracticeName == practice).length;
    }
    return stats
}

function getUniquePractices(array) {
    var flags = [],
        output = [],
        l = array.length,
        i;
    for (i = 0; i < l; i++) {
        if (flags[array[i].RegisteredPracticeName]) continue;
        flags[array[i].RegisteredPracticeName] = true;
        output.push(array[i].RegisteredPracticeName);
    }
    return output;
}

function compareAccubookPinnacle(accubookObjs, pinnacleObjs) {
    var patientsNotFound = {
        pinnacleNotFoundInAccubook: [],
        accubookNotFoundInPinnacle: []
    };
    //accubookObjs = accubookObjs.filter(patient => patient.Arrived == "True");
    pinnacleObjs = pinnacleObjs.filter(patient => patient.Status == "Completed")
    for (pinnaclePatient of pinnacleObjs) {
        search = accubookObjs.filter(patient => patient.NhsNumber == pinnaclePatient.NHSNumber).length;
        if (search === 0) {
            patientsNotFound['pinnacleNotFoundInAccubook'].push(pinnaclePatient);
        }
    }

    for (accubookPatient of accubookObjs) {
        search = pinnacleObjs.filter(patient => patient.NHSNumber == accubookPatient.NhsNumber).length;
        if (search === 0) {
            patientsNotFound['accubookNotFoundInPinnacle'].push(accubookPatient);
        }
    }
    return patientsNotFound;
}

function checkForPinnacleDuplicates(pinnacleObjs) {
    var duplicatePatients = [];
    pinnacleObjs = pinnacleObjs.filter(
        (patient) => patient.Status == "Completed"
    );
    listByDose = [
      pinnacleObjs.filter(
            (patient) => patient.FirstOrSecond == "First Vaccination" 
        ),
      pinnacleObjs.filter(
            (patient) => patient.FirstOrSecond == "Second Vaccination" 
        ),
    ];
    for (list of listByDose) {
        for (pinnaclePatient of list) {
            search = list.filter(
                (patient) => patient.NHSNumber == pinnaclePatient.NHSNumber
            ).length;
            if (search > 1) {
                duplicatePatients.push(pinnaclePatient);
            }
        }
    }
    return duplicatePatients;
}
