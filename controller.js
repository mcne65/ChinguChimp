/**
 * Created by Vampiire on 7/2/17.
 *
 *
 * FOR ADDITIONAL SECURITY
 *      get list of all chingu team names (team ID's) and add them to the slash verify function
 *      to check alongside the slack token. ensures all requests only occur between chingu teams and bot
 *
 */

const express = require('express');
const router = module.exports = express.Router();

const tools = require('./tools/exporter');


// ------------------- SPLASH PAGE ------------------- //

router.get('/form', (req, res) => {

    res.render('form');

});

router.get('/', (req, res) => {

    let data = {

        cohorts: [],

        skills: {

            languages : [],

            frameworks: []
        },

        projects: [],

        certifications: []

    };

    data.userName = 'jessec';


    const userProfile = require('./database/profileModel').userProfile;

    userProfile.addProfile(data);

    res.end('made a new profile');

    // userProfile.getProfile('vampiire').then( doc => console.log(doc.checkins[0].sessions));


});

// -------------------------------------------------- //


// ------------ INCOMING SLASH COMMANDS ------------- //

// ----- CHECK-IN ----- //
router.post('/checkin', (req, res) => {

    const body = req.body;

    if(tools.verify.slash(body.token)) {

        if(!body.text || /^(@[0-9A-Za-z-_.]+( )?)+$/.test(body.text)){
            const user = body.user_name;

            let valueObject = {};

        // filter results to only pass @userName tags then strip the '@' symbol
            let filtered = body.text.split(' ').filter( e => /@[0-9A-Za-z-_.]+/g.test(e));
            filtered.forEach( (e, i, a) => a[i] = e.replace(/\@/g, ''));

        // inject the filtered and stripped partners array into the valueObject
            valueObject.partners = filtered;
        // inject the user calling the checkin so they dont have to tag themselves
            valueObject.partners.push(user);

            res.json(tools.interactive.interaction('checkin', valueObject));
        }
        else res.end('*Invalid checkin command format. Try `/checkin [@userName] [@otherUserName(s)]`. you do not need to tag yourself, the user calling the check-in command is automatically included*');


    }
    else res.end('invalid Slack token');



});

// ----- DISPLAY PROFILE / ITEM ----- //
router.post('/profile', (req, res) => {

    const body = req.body;
    const text = body.text;

    if(tools.verify.slash(body.token)){

        const profileResponse = require('./responses/profileResponses');

        if(!text || text === 'help'){
            res.end(profileResponse.profileHelp());
        }

        if(text && text !== 'help') {
            if (/^\@[0-9A-Za-z-_.]+( share)?( (story|projects|skills|certifications|gitHub|blog|portfolio|))?$/.test(text)) {

                let share = false;
                let item;

                const arguments = text.split(' ');
                let userName = arguments[0].replace(/@/, '');

                if(arguments[1]){
                    if(~arguments[1].indexOf('share')){
                        share = true;

                        if(arguments[2]) item = arguments[2];
                    }
                    else item = arguments[1];
                }


                if(item) profileResponse.profileItem(userName, item, share).then( response => typeof response === 'string' ?
                    res.end(response) : res.json(response));
                else profileResponse.profileCard(userName, share).then( response => res.json(response));

            }

            else res.send(`[\`${text}\`] is not a valid username.
            try again with the format \`/profile <@userName> [share] [profile item]\`
            you may only call one profile look-up at a time`);
        }
    }
    else res.end('invalid Slack token');

});

// ----- UPDATE PROFILE ----- //
router.post('/update', (req, res) => {

    const updateResponse = require('./responses/updateResponses');
    const update = require('./tools/update');
    const userProfile = require('./database/profileModel').userProfile;

    const body = req.body;
    const userName = body.user_name;
    const cohortName = body.team_domain;
    const arguments = body.text;

    if(tools.verify.slash(body.token)){
        if(~arguments.indexOf(' ')){
            let parserOutput = update.parse(arguments);

            if(typeof parserOutput === 'string') res.end(parserOutput);
            else userProfile.processUpdate(userName, cohortName, parserOutput).then( response => res.end(response));

        }

        else{
            if(!arguments || arguments === 'help') res.end(updateResponse.helpResponse('help'));

            else if(arguments === 'skills'){
                const output = tools.interactive.interaction(('update'));
                if(output instanceof Promise) output.then( response => {
                    if(typeof response === 'string') res.end(response);
                    else res.json(response);
                });
                else res.json(output);
            }

            else if(arguments === 'picture'){
                const userID = body.user_id;
                const userProfile = require('./database/profileModel').userProfile;

                tools.requests.userData('pic', userID).then( picObject => {
                    let data = { item: 'profilePic', updateData : picObject };
                    userProfile.processUpdate(userName, cohortName, data).then( response => res.end(response));
                });
            }
            else res.end(updateResponse.helpResponse(arguments));
        }
    }

    else res.end('invalid Slack token');

});

// ------------ INTERACTIVE MESSAGES ---------------- //

// used to handle interactive message responses / submissions
router.post('/interactive', (req, res) => {

    const payload = JSON.parse(req.body.payload);

    if(tools.verify.slash(payload.token)){
        let output = tools.interactive.process(payload);

        if(output instanceof Promise) output.then( response => {
            if(typeof response === 'string') res.end(response);
            else res.json(response);
        });
        else res.json(output);
    }

    else res.end('invalid Slack token');

});

// ------------ INCOMING API CALLS ---------------- //



