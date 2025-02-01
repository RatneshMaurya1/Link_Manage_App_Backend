const express = require("express");
const User = require("../models/user.schema");
const Link = require("../models/link.schema");
const LinkDetails = require("../models/linkDetails.schema")
const linkRouter = express.Router();
const userAuth = require("../middlewares/userAuth");
const crypto = require("crypto");
require("dotenv").config();
const DeviceDetector = require('device-detector-js');
const deviceDetector = new DeviceDetector();

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
  const userAgent = req.headers['user-agent'];
  const device = deviceDetector.parse(userAgent);
  const deviceType = device.device.type;
  const osName = device.os.name;
  const browserName = device.client.name;

  try {
    const requestKey = `${ip}-${shortLink}`;

    const link = await Link.findOne({ shortLink: `${process.env.BACKEND_URL}/${shortLink}` });

    if (!link) {
      return res.status(404).json({ error: "Short link not found." });
    }

    if (link.expire && new Date(link.expire) < new Date()) {
      return res.status(410).json({ error: "This link has expired." });
    }

    if (recentRequests.has(requestKey)) {
      const lastRequestTime = recentRequests.get(requestKey);
      const currentTime = Date.now();

      if (currentTime - lastRequestTime < 7000) {
        console.log("Duplicate request detected, ignoring.");
        return res.redirect(link.originalLink); 
      }
    }

    recentRequests.set(requestKey, Date.now());

    await Link.findOneAndUpdate(
      { shortLink: `${process.env.BACKEND_URL}/${shortLink}` },
      { $inc: { count: 1 } }
    );

    await LinkDetails.create({
      ipAdress: ip,
      userId: link.userId,
      userDevice: osName,
      browser:browserName,
      linkId: link._id,
      deviceType,
      time: new Date() 
    });
    console.log(`Count incremented. Redirecting to: ${link.originalLink}`);
    res.redirect(link.originalLink);

  } catch (error) {
    console.error("Error updating count and redirecting:", error);
    res.status(500).json({ error: "An error occurred while redirecting." });
  }
});

linkRouter.post("/updateLink/:id",userAuth,async(req,res) => {
  const {id} = req.params
  const { originalLink, remark, expire } = req.body;
  try {
    if(!originalLink && !remark && !expire){
      return res.status(400).json({message:"Please provide atleast one field to update."})
    }
    const link = await Link.findOne({_id:id})
    if(!link){
      return res.status(404).json({message:"Link not found"})
    }
    if (originalLink) link.originalLink = originalLink;
    if (remark) link.remark = remark;
    if (expire) link.expire = expire;

    await link.save()
    res.status(200).json({message:"Link updated successfully.",link})
  }catch (error) {
    res.status(500).json({ error: "Error while updating Link data." });
  }
})

linkRouter.delete("/deleteLink/:id", userAuth, async (req, res) => {
  const { id } = req.params;
  console.log(id)

  try {
    const deletedLink = await Link.findByIdAndDelete(id);

    if (!deletedLink) {
      return res.status(200).json({ message: "Link not found" });
    }
    await LinkDetails.deleteMany({ linkId: id });

    return res.status(200).json({ message: "Link deleted successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error while deleting the link." });
  }
});


linkRouter.get("/user/links", userAuth, async (req, res) => {
  const user = req.user;
  const { search, page = 1, limit = 7 } = req.query; 
  
  try {
    let linksQuery = { userId: user._id };

    if (search && search !== "null") {
      linksQuery.remark = { $regex: search, $options: "i" };
    }

    const skip = (page - 1) * limit; 
    const links = await Link.find(linksQuery).skip(skip).limit(Number(limit));

    if (!links || links.length === 0) {
      return res.status(200).json({ error: "No links found for this user." });
    }

    const totalLinks = await Link.countDocuments(linksQuery);
    const totalPages = Math.ceil(totalLinks / limit);

    const linksWithStatus = links.map((link) => {
      const expireUTC = link.expire ? new Date(link.expire).toISOString() : null;
      const nowUTC = new Date().toISOString(); // Ensure comparison is in UTC
    
      console.log("Checking expiration:", {
        expireUTC,
        nowUTC,
        isExpired: expireUTC && expireUTC < nowUTC,
      });
    
      return {
        _id: link._id,
        originalLink: link.originalLink,
        shortLink: link.shortLink,
        remark: link.remark,
        expire: link.expire,
        count: link.count,
        userDevice: link.userDevice,
        ipAdress: link.ipAdress,
        status: expireUTC && expireUTC < nowUTC ? "inactive" : "active",
        createdAt: link.createdAt,
      };
    });
    

    res.status(200).json({
      links: linksWithStatus,
      totalPages,
      currentPage: page,
      totalLinks, 
    });
  } catch (error) {
    console.error("Error fetching user links:", error);
    res.status(500).json({ error: "An error occurred while fetching links." });
  }
});


linkRouter.get("/links/details", userAuth, async (req, res) => {
  const user = req.user;
  const { page = 1, limit = 7 } = req.query;

  try {
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    const totalLinks = await LinkDetails.countDocuments({ userId: user._id });

    const linksData = await LinkDetails.find({ userId: user._id })
      .populate("linkId")
      .sort({ time: -1 }) 
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    res.status(200).json({
      links: linksData,
      totalPages: Math.ceil(totalLinks / limitNumber),
    });
  } catch (error) {
    console.error("Error fetching user links:", error);
    res.status(500).json({ error: "An error occurred while fetching links." });
  }
});
linkRouter.get("/link/allLinksdetails", userAuth, async (req, res) => {
  const user = req.user;

  try {


    const linksData = await LinkDetails.find({ userId: user._id })
      .populate("linkId")

    res.status(200).json({
      links: linksData,
    });
  } catch (error) {
    console.error("Error fetching user links:", error);
    res.status(500).json({ error: "An error occurred while fetching links." });
  }
});
linkRouter.get("/link/allLink", userAuth, async (req, res) => {
  const user = req.user;

  try {


    const linksData = await Link.find({ userId: user._id })

    res.status(200).json({
      links: linksData,
    });
  } catch (error) {
    console.error("Error fetching user links:", error);
    res.status(500).json({ error: "An error occurred while fetching links." });
  }
});




module.exports = linkRouter;
