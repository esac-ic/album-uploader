#!/usr/bin/env node

const inquirer = require("inquirer");
const chalk = require("chalk");
const figlet = require("figlet");
const path = require("path");
const fs = require("fs");
const Uploader = require("./uploader");
const Draftlog = require("draftlog").into(console);

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
        },
        {
            name: "BATCH_SIZE",
            type: "number",
            message: "What is the maximum batch size for the API requests, i.e. what is PHP's max post size? (in MB)",
            default: 50
        }
    ];
    return inquirer.prompt(questions);
};



const run = async () => {
    // Show introduction
    intro();

    // ask questions
    const answers = await askQuestions();
    const { BASEFOLDER, URL, API_KEY, BATCH_SIZE } = answers;

    let uploader = new Uploader(URL, API_KEY, BATCH_SIZE);

    fs.readdir(BASEFOLDER, (err, files) => {
        if (!files) {
            console.log(chalk.white.bgRed.bold("Base folder does not exist."));
            return;
        }

        files.forEach(file => {
            let progress = console.draft('Starting conversion...');
            uploader.uploadAlbum(progress, path.join(BASEFOLDER, file));
        });
    });
};

run();