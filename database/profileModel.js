/**
 * Created by Vampiire on 7/3/17.
 *
 */


const mongoose = require('mongoose');
const requests = require('../tools/requests');
const dbHelper = require('./dbHelpers');

// sub-schemas
    const sessionSchema = new mongoose.Schema({
        kind: String,
        task: String,
        partners: [String],
        date: {type: Number, default: Date.now()}
    });

    const checkinSchema = new mongoose.Schema({
        channelID : String,
        sessions: [sessionSchema]
    });

const checkinModel = mongoose.model('checkinModel', checkinSchema);

// main user profile schema
    const userSchema = new mongoose.Schema({

        userName: {type: String, lowercase: true},

        profilePic : {
            size_72 : {type: String, default: null},
            size_192 : {type: String, default: null}
        },

        portfolio: {type: String, default: null},
        gitHub: {type: String, default: null},
        blog: {type: String, default: null},

        story: String,

        joinDate: {type: Number, default: Date.now()},

    // automatically add new cohorts to returning users' profiles
        cohorts: [{
            cohortName: String,
            // cohortID: String,
            // considering capturing this for added security / cross-checking
                // could require a password when a non-recognized cohort is detected
            startDate: {type: Number, default: Date.now()},
        }],

        skills: {

            languages: [{
                name: String,
                level: String
            }],

            frameworks: [{
                name: String,
                level: String
            }]
        },

        checkins: [checkinSchema],

        projects: [{
            name: String,
            url: {type: String, default: null},
            gitHub: {type: String, default: null},
            completedDate: {type: Number, default: Date.now()}
        }],

        certifications: [{
            name: String,
            url: {type: String, default: null},
            date: {type: Number, default: Date.now()}
        }],

    // profile card data
        points: {type: Number, default: 1},
        bestStreak: {type: Number, default: 0},
        currentStreak: {
            value: {type: Number, default: 0},
            lastUpdate: {type: Number, default: Date.now()}
        },
        lastCheckin: sessionSchema,
        totalCheckins: {type: Number, default: 0},
        badges : [{
            badgeType : String,
            name : String,
            url : String
        }],

    }, { runSettersOnQuery : true });

// ----------------- PROFILE MODEL METHODS ---------------- //
        // ----- embedded database methods ----- //

    userSchema.statics.addProfile = function(formData){
        this.create(formData, e => e ? console.log(e) : false);
    };

    userSchema.statics.getProfile = function(userName){
        return this.findOne({userName : userName});
    };

    userSchema.statics.getProfileItem = function(userName, item){
        return this.findOne({userName : userName}, item);
    };


// ----------------- CUSTOM METHODS ----------------- //

// ------- CHECKIN PROCESSING ------- //
userSchema.statics.processCheckin = function(userName, cohortName, channelID, checkinSessionData){

    return new Promise( (resolve, reject) => {
        this.findOne({userName: userName}).then( profileDoc => {
            if(profileDoc){


// REMOVE AFTER TESING ------ remove this line after beta testing
                if(!profileDoc.badges.some( e => e.name === 'Beta Tester: Chingu Chimp'))
                profileDoc.badges.push(dbHelper.newBadge('Chingu Chimp Beta Tester'));

                if(userName === 'chance') profileDoc.badges.push(dbHelper.newBadge('founder'));
// REMOVE AFTER TESING

                profileDoc.cohorts = dbHelper.checkAndAddCohort(profileDoc.cohorts, cohortName);

                const checkins = profileDoc.checkins;
                let channel = checkins.find( e => e.channelID === channelID);

                channel ?
                    channel.sessions.push(checkinSessionData) :
                    checkins.push(new checkinModel({channelID : channelID, sessions : [checkinSessionData]}));

                const streakUpdate = dbHelper.streakUpdater(checkins, profileDoc.currentStreak, profileDoc.bestStreak);
                profileDoc.currentStreak = streakUpdate.currentStreak;
                profileDoc.bestStreak = streakUpdate.bestStreak;


                profileDoc.lastCheckin = checkinSessionData;
                profileDoc.totalCheckins++;

                profileDoc.save( (saveError, success) => {

                    userName = `${userName.slice(0,1).toUpperCase()}${userName.slice(1)}`;

                    if(saveError) resolve(saveError);
                    if(success){
                        if(channel) resolve(`succesfully saved the check-in for ${userName}. you have \`${channel.sessions.length}\` checkins on this channel!\n*Total check-ins:* \`${profileDoc.totalCheckins}\n\`*current streak:* \`${profileDoc.currentStreak.value}\`\n*best streak:* \`${profileDoc.bestStreak}\`\n`);
                        else resolve(`succesfully saved the check-in for ${userName}. This is your first check-in on this channel, keep it up!\n*Total check-ins:* \`${profileDoc.totalCheckins}\n*current streak:* \` ${profileDoc.currentStreak.value}\`\n*best streak:* \`${profileDoc.bestStreak}\`\n`);
                    }
                });
            }

            else resolve(`*Check-in for \`@${userName}\` failed:*\n*profile \`@${userName}\` not found*\n*create a profile <url|here>*\n`);
        });
    });
};

// ------- UPDATE PROCESSING ------- //
userSchema.statics.processUpdate = function(userName, cohortName, data){

    return new Promise((resolve, reject) => {

        this.findOne({userName: userName}).then( profileDoc => {

            if(profileDoc){

                // if the cohort the user is updating from is not in their profile then it is added in this step
                let cohorts = profileDoc.cohorts;
                profileDoc.cohorts = checkAndAddCohort(cohorts, cohortName);

                let updateItem = data.item;
                let updateData = data.updateData;

                switch(updateItem){
                // pushing updateData into a profile item array
                    case 'certifications':
                    case 'projects':
                        // add a badge after 5 - 10 etc completed projects
                        // move higher badge to front of badges array
                        profileDoc[updateItem].push(updateData);
                        break;

                // pushing updateData into a nested profile item array
                    case 'skills':
                        // add a badge after 2+ languages
                        // add a badge after 2+ frameworks
                        const subUpdateItem = data.subItem;
                        const skillsItem = profileDoc[updateItem][subUpdateItem];

                        // handles updating an existing skill
                        let skillsItemIndex;
                        if(skillsItem.some( (skill, index) => {
                                if(skill.name === updateData.name){
                                    skillsItemIndex = index;
                                    return true
                                }
                            })) skillsItem[skillsItemIndex].level = updateData.level;

                        // no existing skill, add a new one
                        else skillsItem.push(updateData);
                        break;

                // setting the url field
                    case 'blog':
                    case 'gitHub':
                    case 'portfolio':
                        profileDoc[updateItem] = updateData.url;
                        break;

                // simple string/number/object
                    case 'profilePic':
                    case 'story':
                        profileDoc[updateItem] = updateData;
                        break;
                }

                return profileDoc.save( (saveError, doc) => {
                    if(saveError) resolve(`error updating ${updateItem} for ${userName}`);
                    else if(updateItem === 'skills')
                        resolve(`*Successfully updated your ${data.subItem}: ${updateData.name} at the ${updateData.level} skill level*`);
                    else resolve(`*Successfully updated your ${updateItem}*`);

                });
            }

            else{
                // alert the AutoBot to message the user who does not have an account. pass on the link to set up their profile
                resolve (`*Update for \`@${userName}\` failed:*\n*profile \`@${userName}\` not found.*\ncreate a profile <url|here>*\n`);
            }

        })

    })
};


const userProfile = mongoose.model('userProfile', userSchema);

module.exports = {
    userSchema,
    userProfile,
    checkinSchema,
    checkinModel
};




