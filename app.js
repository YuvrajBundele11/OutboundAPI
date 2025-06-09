require('dotenv').config(); // <-- Load env variables

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// Middleware
app.use(cors());
app.use(bodyParser.json());

async function connectDB() {
    await client.connect();
    console.log('Connected to MongoDB');
}

const database = client.db('accountDB');
const accounts = database.collection('account');

// Routes

// GET all accounts
app.get('/accounts', async(req, res) => {
    const allAccounts = await accounts.find().toArray();
    res.json(allAccounts);
});

// GET single account by _id
app.get('/accounts/:id', async(req, res) => {
    const id = req.params.id;
    const account = await accounts.findOne({ _id: new ObjectId(id) });
    res.json(account);
});

// POST create new account (supporting Salesforce Id)
app.post('/accounts', async(req, res) => {
    const accountData = req.body;

    if (!accountData.accountName || !accountData.accountEmail || !accountData.phone) {
        return res.status(400).send('Missing required fields');
    }

    // Optionally include sfAccountId if sent
    const accountDocument = {
        accountName: accountData.accountName,
        accountEmail: accountData.accountEmail,
        phone: accountData.phone,
        ...(accountData.sfAccountId && { sfAccountId: accountData.sfAccountId })
    };

    const result = await accounts.insertOne(accountDocument);
    res.json({ insertedId: result.insertedId });
});

// INSERT via GET with URL query parameters
app.get('/insertAccount', async(req, res) => {
    const { accountName, accountEmail, phone, sfAccountId } = req.body;

    if (!accountName || !accountEmail || !phone) {
        return res.status(400).send('Missing required fields');
    }

    const accountDocument = {
        accountName,
        accountEmail,
        phone
    };

    try {
        const result = await accounts.insertOne(accountDocument);
        const insertedId = result.insertedId;

        if (sfAccountId) {
            await accounts.updateOne({ _id: insertedId }, { $set: { sfAccountId } });
        }

        res.send(`Inserted account with ID: ${insertedId}`);
    } catch (error) {
        console.error('Error inserting account:', error);
        res.status(500).send('Server error while inserting account');
    }
});

// PUT update account by MongoDB _id
app.put('/accounts/:id', async(req, res) => {
    const id = req.params.id;
    const updatedData = req.body;

    const result = await accounts.updateOne({ _id: new ObjectId(id) }, { $set: updatedData });

    res.json({ modifiedCount: result.modifiedCount });
});

// PUT update account by Salesforce Id via URL params
app.put('/updateAccount', async(req, res) => {
    const sfAccountId = req.query.sfId;
    const accountName = req.query.accountName;
    const accountEmail = req.query.accountEmail;
    const phone = req.query.phone;

    if (!sfAccountId) {
        return res.status(400).send('Missing Salesforce Id (sfId)');
    }

    const updatedData = {
        ...(accountName && { accountName }),
        ...(accountEmail && { accountEmail }),
        ...(phone && { phone })
    };

    const result = await accounts.updateOne({ sfAccountId: sfAccountId }, { $set: updatedData });

    if (result.matchedCount === 0) {
        return res.status(404).send('No record found with this Salesforce Id');
    }

    res.json({ modifiedCount: result.modifiedCount });
});

// Start server
app.listen(port, async() => {
    await connectDB();
    console.log(`Server running on http://localhost:${port}`);
});