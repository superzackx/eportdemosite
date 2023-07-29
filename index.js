const express = require("express")
const app = express();

const port = 3000;
app.set("view engine", "ejs")

app.use(express.static('public'))

const mongoose = require("mongoose")
mongoose.connect("MONGO_URL", { useNewUrlParser: true, useUnifiedTopology: true })

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json())

const postModel = new mongoose.Schema({
    message: {
        type: String,
        required: true
    },
    user: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

const Post = mongoose.model('Post', postModel)

const { auth, requiresAuth } = require('express-openid-connect');

const config = {
    authRequired: false,
    auth0Logout: true,
    secret: 'a long, randomly-generated string stored in env',
    baseURL: 'http://localhost:3000/',
    clientID: 'clientID for Auth0',
    issuerBaseURL: 'baseURL for Auth0'
};

// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(config));

const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: 'OPENAI_API_KEY',
});

const openai = new OpenAIApi(configuration);

app.get("/", async (req, res) => {
    let posts = await Post.find({}).lean();
    let isSpammer;
    let loggedIn;
    if (req.oidc.user) {
        loggedIn = true;
    } else {
        loggedIn = false;
    }
    if(req.query.spam){
        isSpammer = true;
    } else {
        isSpammer = false;
    }
    console.log(isSpammer)
    res.render("index", { loggedIn: loggedIn, posts: posts, isSpammer: isSpammer})
})

app.get("/user/:id", async (req, res) => {
    let loggedIn;
    if (req.oidc.user) {
        loggedIn = true;
    } else {
        loggedIn = false;
    }
    let posts = await Post.find({ user: req.params.id }).lean()
    res.render('user', { posts: posts, user: req.params.id, loggedIn: loggedIn })
})

app.get("/about" , (req, res)=> {
    let loggedIn;
    if (req.oidc.user) {
        loggedIn = true;
    } else {
        loggedIn = false;
    }
    res.render("about", {loggedIn: loggedIn})
})

app.post("/new", requiresAuth(), async (req, res) => {

    const response = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{
            "role": "user", "content": `You are a spam message checker for a social media. Spam includes messages which are gibberish, or make no sense. Advertising also spam. Be quite strict with the sorting. You must respond in JSON in this format: {"spam": "true"} or {"spam": "false"} in valid JSON. This is the message: ${req.body.message}`
        }],
    });

    let givenResponse = response.data.choices[0].message.content;

    givenResponse = givenResponse.trim();
    givenResponse = JSON.parse(givenResponse)

    console.log(givenResponse)

    if (givenResponse.spam === "true") {
        res.redirect("/?spam=true")
    } else {
        let post = new Post({
            message: req.body.message,
            user: req.oidc.user.nickname
        })
        await post.save();
        res.redirect(`/#${post._id}`)
    }
})

app.listen(port, () => {
    console.log(`Server listening on port ${port}`)
})