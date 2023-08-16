//jshint esversion:6
const dotenv = require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose")
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

const findOrCreate = require('mongoose-findorcreate')

//const encrypt = require("mongoose-encryption")
//const md5 = require('md5');
//const bcrypt = require('bcrypt');
//const saltRounds = 10;

const app = express();
app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect('mongodb://127.0.0.1:27017/userDB')
userDbSchema = mongoose.Schema({
    userName: String,
    password: String,
    googleId: String,
    secret: String
})
;


//encrypt when save() call and decrypt when find() call
//userDbSchema.plugin( encrypt, {secret: process.env.SECRET,  encryptedFields:  ['password'] ,excludeFromEncryption:  ['userName'] } ) ;

userDbSchema.plugin(passportLocalMongoose);
userDbSchema.plugin(findOrCreate);
const User = mongoose.model("User", userDbSchema);

//this is for hash and salt password and create, remove cookie
passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      cb(null, { id: user.id, username: user.username });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  async function(accessToken, refreshToken, profile, cb) {
    console.log(profile)
    await User.findOrCreate({ googleId: profile.id, username: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: "http://localhost:3000/auth/facebook/callback"
},
  async function(accessToken, refreshToken, profile, cb) {
  await User.findOrCreate({ username: profile.id }, function (err, user) {
    return cb(err, user);
  });
}
));


app.get("/", function(req, res){
    res.render("home");
});

app.get('/auth/google',
//using the strategy for google everytime authenticate call
  passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/secrets', 
passport.authenticate('google', { failureRedirect: '/login' }),
function(req, res) {
// Successful authentication, redirect home.
res.redirect('/secrets');
});

app.get('/auth/facebook',
  passport.authenticate('facebook'));

app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

app.get("/login", function(req, res){
    res.render("login");
})
app.get("/register", function(req, res){
    res.render("register");
})
app.get("/secrets", async function(req, res){
    const foundUsers = await User.find({"secret": {$ne: null}});
    res.render("secrets", {usersWithSecrets: foundUsers});
})
app.get("/logout", function(req, res){
    req.logOut(function(err){
        if(err){
            console.log(err);
        }
        else{
            res.redirect("/");
        }
    })
})

app.get("/submit", function(req, res){
  if(req.isAuthenticated()){
    res.render("submit")
  }
  else{
    res.redirect("/login")
  }
})


app.post("/register", async function(req, res){
    // console.log(req.body.username);
    // const result = await User.findOne({userName: req.body.username});
    // if(!result){
    //     bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
    //         // Store hash in your password DB.
    //         if(!err){
    //             const newUser = new User({
    //                 userName: req.body.username,
    //                 password: hash
    //             });
    //             newUser.save();    
    //             res.render("secrets");
    //         }
            
    //     });
        
    // }
    // else{
    //     res.send("Username is already used");
    // }
    User.register({username:req.body.username}, req.body.password, function(err, user) {
        if (err) { 
          console.log(err);
          res.redirect("/register");
         } else {
          passport.authenticate("local")(req,res,function(){
            res.redirect("/secrets");
          })
          
         }
       
        });
})

app.post("/login", async function(req, res){
    // let username = req.body.username;
    // let password = req.body.password;
    // const foundUser = await User.findOne({userName: username});
    // if(!foundUser){
    //     res.send("Username is not exist");
    // }
    // else{
    //     bcrypt.compare(password, foundUser.password , function(err, result) {
    //         if(result == true){
    //             res.render("secrets");
    //         }
    //         else{
    //             res.send("Incorrect password");
    //         }
    //     });
    // }
    

    //username is default can't change
    const user = new User({
        username:req.body.username,
        password:req.body.password
      })
     
      await req.login(user,function(err){
        if (err) { 
          console.log(err);
          res.redirect("/login");
         } else {
          passport.authenticate("local")(req,res,function(){
            res.redirect("/secrets");
          })
         }
        })
        
})

app.post("/submit", async function(req, res){
  const submittedSecret = req.body.secret;
  foundUser = await User.findById(req.user.id);
    if(foundUser){
      foundUser.secret = submittedSecret;
      await foundUser.save()
      res.redirect("/secrets");
    }
    
});
app.listen(3000, function(){
    console.log("Server started on port 3000");
})