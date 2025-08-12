import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";

const app = express();
const port = 3000;



import dotenv from 'dotenv';
dotenv.config();
// SECURE way - using environment variables
const db = new pg.Client({
  connectionString: process.env.DATABASE_URL, // Switches based on environment
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.set("view engine", "ejs");
app.set("views", "./views");

app.get("/", async (req, res) => {  
  try {
    // Get all books from database
    const result = await db.query("SELECT * FROM books ORDER BY created_at DESC");
    const books = result.rows;
    
    res.render("index.ejs", { books: books });
  } catch (error) {
    console.error("Error fetching books:", error);
    res.render("index.ejs", { books: [] });
  }
});


// Add this after db.connect();
const createTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        recommendation INTEGER CHECK (recommendation >= 0 AND recommendation <= 10),
        description TEXT,
        date_read DATE,
        cover_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Books table ready!");
  } catch (error) {
    console.error("Error creating table:", error);
  }
};

createTable();


app.post("/add", async (req, res) => {   
  // Add your logic here
  const { bookName, recommendation, description, date } = req.body;
  
  try {
    // Search for book using Open Library API
    const searchResponse = await axios.get(`https://openlibrary.org/search.json?title=${encodeURIComponent(bookName)}&limit=1`);
    
    let coverUrl = null;
    if (searchResponse.data.docs && searchResponse.data.docs.length > 0) {
      const book = searchResponse.data.docs[0];
      if (book.cover_i) {
        // Get book cover using the cover ID
        coverUrl = `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`;
      }
    }
    
    // Insert book into database
    const result = await db.query(
      "INSERT INTO books (title, recommendation, description, date_read, cover_url) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [bookName, parseInt(recommendation), description, date, coverUrl]
    );
    
    console.log("Book added:", result.rows[0]);
    res.redirect("/");
    
  } catch (error) {
    console.error("Error adding book:", error);
    res.status(500).send("Error adding book");
  }
});

app.post("/edit", async (req, res) => {
  const { bookName, recommendation, description, date, bookId } = req.body;

  try {
    await db.query(
      "UPDATE books SET title = $1, recommendation = $2, description = $3, date_read = $4 WHERE id = $5", 
      [bookName, parseInt(recommendation), description, date, bookId]
    );
    console.log("Book updated successfully");
    res.redirect("/");
  } catch (error) {
    console.error("Error updating book:", error);
    res.status(500).send("Error updating book");
  }
});

app.post("/delete", async(req, res) => {
  const bookId = req.body.bookId;
  
  try {
    await db.query("DELETE FROM books WHERE id = $1", [bookId]);
    console.log("Book deleted successfully");
    res.redirect("/");
  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).send("Error deleting book");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});