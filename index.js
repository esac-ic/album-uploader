#!/usr/bin/env node

const inquirer = require("inquirer");
const chalk = require("chalk");
const figlet = require("figlet");
const path = require("path");
const fs = require("fs");
const Uploader = require("./uploader");

// Fancy introduction message :)
const intro = () => {
    console.log(
        chalk.green(
            figlet.textSync("ESAC album uploader", {
                font: "Ogre",
                horizontalLayout: "default",
                verticalLayout: "default"
            })
        )
    );
};

const askQuestions = () => {
    const questions = [
        {
            name: "BASEFOLDER",
            type: "input",
            message: "What is the (relative or absolute) location of the folder containing the albums?"
        },
        {
            name: "URL",
            type: "input",
            message: "What is the base URL of the photoalbums API endpoint?",
            default: "https://esac.nl/api/photoalbums"
        },
        {
            name: "API_KEY",
            type: "input",
            message: "What is the API_KEY to authenticate with the API, as configured in the .env?",
        }
    ];
    return inquirer.prompt(questions);
};



const run = async () => {
    // Show introduction
    intro();

    // ask questions
    const answers = await askQuestions();
    const { BASEFOLDER, URL, API_KEY } = answers;

    let uploader = new Uploader(URL, API_KEY);

    fs.readdir(BASEFOLDER, (err, files) => {
        files.forEach(file => {
            uploader.uploadAlbum(path.join(BASEFOLDER, file));
        });
    });

    // show success message
};

run();