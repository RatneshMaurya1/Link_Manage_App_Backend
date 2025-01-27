const express = require("express");
const User = require("../models/user.schema");
const Link = require("../models/link.schema");
const LinkDetails = require("../models/linkDetails.schema")
const linkRouter = express.Router();
const userAuth = require("../middlewares/userAuth");
const crypto = require("crypto");
require("dotenv").config();

const generateShortLink = () => {
  return crypto.randomBytes(4).toString("hex");
};

linkRouter.post("/create", userAuth, async (req, res) => {
  const user = req.user;
  const { originalLink, remark, expire } = req.body;

  try {
    if (!originalLink) {
      return res.status(400).json({ error: "Original link is required." });
    }

    const ipAddress = req.headers["x-forwarded-for"]?.split(",")[0] || req.ip;
    const userDevice = req.headers["user-agent"] || "Unknown";

    let shortLink;
    let isUnique = false;

    while (!isUnique) {
      shortLink = generateShortLink();
      const existingLink = await Link.findOne({ shortLink });
      if (!existingLink) isUnique = true;
    }

    const newLink = new Link({
      userId: user._id,
      originalLink,
      shortLink: `${process.env.BACKEND_URL}/${shortLink}`,
      remark,
      expire,
    });

    await newLink.save();

    res.status(201).json({
      message: "Short link created successfully.",
      shortLink: `${process.env.BACKEND_URL}/${shortLink}`,
    });
  } catch (error) {
    console.error("Error creating short link:", error);
    res
      .status(500)
      .json({ error: "An error occurred while creating the short link." });
  }
});
const recentRequests = new Map(); 


linkRouter.get("/:shortLink", async (req, res) => {
  const { shortLink } = req.params;
  const ip = req.ip;
  const userDevice = req.headers['user-agent'];

  try {
    const requestKey = `${ip}-${shortLink}`;

    const link = await Link.findOne({ shortLink: `${process.env.LOCAL_BACKEND_URL}/${shortLink}` });

    if (!link) {
      return res.status(404).json({ error: "Short link not found." });
    }

    if (link.expire && new Date(link.expire) < new Date()) {
      return res.status(410).json({ error: "This link has expired." });
    }

    if (recentRequests.has(requestKey)) {
      const lastRequestTime = recentRequests.get(requestKey);
      const currentTime = Date.now();

      if (currentTime - lastRequestTime < 1000) {
        console.log("Duplicate request detected, ignoring.");
        return res.redirect(link.originalLink); 
      }
    }

    recentRequests.set(requestKey, Date.now());

    await Link.findOneAndUpdate(
      { shortLink: `${process.env.LOCAL_BACKEND_URL}/${shortLink}` },
      { $inc: { count: 1 } }
    );

    await LinkDetails.create({
      ipAdress: ip,
      userId: link.userId, 
      userDevice: userDevice,
      linkId: link._id, 
      time: new Date() 
    });

    res.redirect(link.originalLink);

  } catch (error) {
    console.error("Error updating count, creating LinkDetails entry, and redirecting:", error);
    res.status(500).json({ error: "An error occurred while redirecting." });
  }
});


linkRouter.get("/user/links", userAuth, async (req, res) => {
  const user = req.user;

  try {
    const links = await Link.find({ userId: user._id });

    if (!links || links.length === 0) {
      return res.status(404).json({ error: "No links found for this user." });
    }

    const linksWithStatus = links.map((link) => {
      const isExpired = link.expire && new Date(link.expire) < new Date();
      return {
        _id:link._id,
        originalLink: link.originalLink,
        shortLink: link.shortLink,
        remark: link.remark,
        expire: link.expire,
        count: link.count,
        userDevice: link.userDevice,
        ipAdress: link.ipAdress,
        status: isExpired ? "inactive" : "active",
      };
    });

    const linksWithFinalStatus = linksWithStatus.map((link) => {
      if (!link.expire) {
        link.status = "active";
      }
      return link;
    });

    res.status(200).json({ links: linksWithFinalStatus });
  } catch (error) {
    console.error("Error fetching user links:", error);
    res.status(500).json({ error: "An error occurred while fetching links." });
  }
});

module.exports = linkRouter;
