//dependencies
var express = require("express");
var router = express.Router();
var path = require("path");

//require request and cheerio to scrape
var request = require("request");
var cheerio = require("cheerio");
var axios = require("axios");

//Require models
var Comment = require("../models/comment.js");
var Article = require("../models/article.js");

//index
router.get("/", function(req, res) {
  res.redirect("/articles");
});

router.get("/scrape", function(req, res) {
  ////get html
  axios.get("https://www.nytimes.com/section/us").then(function(response) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(response.data);
    var titlesArray = [];
    $("article > div").each(function(i, element) {
      var result = {};

      // Add the text and href of every link, and save them as properties of the result object
      result.title = $(element)
        .children("h2")
        .text();
      result.link = $(element)
        .find("a")
        .attr("href");
      result.summary = $(element)
        .find("p")
        .first()
        .text();
      //ensures that no empty title or links are sent to mongodb
      if (result.title !== "" && result.link !== "") {
        //check for duplicates
        if (titlesArray.indexOf(result.title) == -1) {
          // push the saved title to the array

          titlesArray.push(result.title);

          // only add the article if is not already there
          Article.count({ title: result.title }, function(err, test) {
            //if the test is 0, the entry is unique and good to save
            if (test == 0) {
              var entry = new Article(result);

              entry.save(function(err, doc) {
                if (err) {
                  console.log(err);
                } else {
                  console.log(doc);
                }
              });
            }
          });
        }
      }
    });
    res.redirect("/");
  });
});

//this will grab every article an populate the DOM
router.get("/articles", function(req, res) {
  //allows newer articles to be on top
  Article.find()
    .sort({ _id: -1 })
    //send to handlebars
    .exec(function(err, doc) {
      if (err) {
        console.log(err);
      } else {
        var artcl = { articles: doc };
        res.render("index", artcl);
      }
    });
});

// This will get the articles we scraped from the mongoDB in JSON
router.get("/articles-json", function(req, res) {
  Article.find({}, function(err, doc) {
    if (err) {
      console.log(err);
    } else {
      res.json(doc);
    }
  });
});

router.get("/articles/:id", function(req, res) {
  var articleId = req.params.id;
  var hbsObj = {
    article: {}
  };

  Article.findOne({ _id: articleId })
    .populate("comment")
    .exec(function(err, doc) {
      if (err) {
        console.log("Error: " + err);
      } else {
        hbsObj.article = doc;
        var link = doc.link;
        //grab article from link
        res.render("article", hbsObj);
      }
    });
});

router.post("/articles/:id/comment", function(req, res) {
  var article = {};
  Article.findById(req.params.id)
    .then(function(newArticle) {
      article = newArticle;

      var comment = new Comment();
      comment.name = req.body.name;
      comment.body = req.body.comment;

      return comment.save();
    })
    .then(function(comment) {
      article.comment = article.comment || [];
      article.comment.push(comment._id);
      return article.save();
    })
    .then(function(article) {
      res.redirect("/articles/" + req.params.id);
    })
    .catch(function(err) {
      console.log(err);
    });
});

module.exports = router;
