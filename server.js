const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const config = require('./src/config');

// Initialize express app
const app = express();
const PORT = config.PORT;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialize SQLite database
const db = new sqlite3.Database(config.DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log(`Connected to the SQLite database at ${config.DB_PATH}`);
    
    // Create tables if they don't exist
    db.run(`CREATE TABLE IF NOT EXISTS communities (
      name TEXT PRIMARY KEY,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      community TEXT NOT NULL,
      author TEXT DEFAULT 'anonymous',
      votes INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (community) REFERENCES communities (name)
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      content TEXT NOT NULL,
      author TEXT DEFAULT 'anonymous',
      votes INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts (id)
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      post_id TEXT,
      comment_id TEXT,
      vote_type TEXT CHECK(vote_type IN ('up', 'down')),
      UNIQUE(user_id, post_id, comment_id)
    )`);
    
    // Insert default communities if they don't exist
    const defaultCommunities = [
      ['philosophy', 'Discuss philosophical topics and ideas'],
      ['technology', 'Share and learn about the latest in tech'],
      ['community', 'Community building and social discourse'],
      ['science', 'Scientific discoveries and discussions'],
      ['art', 'Share and appreciate art in all forms'],
      ['law', 'Legal discussions and advice'],
      ['medicine', 'Medical discussions and health advice'],
      ['education', 'Topics related to learning and teaching'],
      ['hi', 'Discussions about hi'],
    ];
    
    const insertCommunity = db.prepare('INSERT OR IGNORE INTO communities (name, description) VALUES (?, ?)');
    defaultCommunities.forEach(community => {
      insertCommunity.run(community);
    });
    insertCommunity.finalize();
  }
});

// API Routes
// Search API Routes
// Search for posts
app.get('/api/search/posts', (req, res) => {
  const query = req.query.q;
  
  if (!query || query.trim() === '') {
    return res.json([]);
  }
  
  const searchTerm = `%${query}%`;
  
  db.all(
    `SELECT id, title, community 
     FROM posts 
     WHERE title LIKE ? OR content LIKE ? 
     ORDER BY created_at DESC 
     LIMIT 10`,
    [searchTerm, searchTerm],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Search for communities
app.get('/api/search/communities', (req, res) => {
  const query = req.query.q;
  
  if (!query || query.trim() === '') {
    return res.json([]);
  }
  
  const searchTerm = `%${query}%`;
  
  db.all(
    `SELECT name, description 
     FROM communities 
     WHERE name LIKE ? OR description LIKE ? 
     ORDER BY name ASC 
     LIMIT 10`,
    [searchTerm, searchTerm],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Search for comments
app.get('/api/search/comments', (req, res) => {
  const query = req.query.q;
  
  if (!query || query.trim() === '') {
    return res.json([]);
  }
  
  const searchTerm = `%${query}%`;
  
  db.all(
    `SELECT c.id, c.content, c.post_id as postId
     FROM comments c
     WHERE c.content LIKE ?
     ORDER BY c.created_at DESC
     LIMIT 10`,
    [searchTerm],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Get all communities
app.get('/api/communities', (req, res) => {
  db.all('SELECT * FROM communities ORDER BY name ASC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get a specific community
app.get('/api/communities/:name', (req, res) => {
  db.get('SELECT * FROM communities WHERE name = ?', [req.params.name], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }
    res.json(row);
  });
});

// Get posts by community
app.get('/api/communities/:name/posts', (req, res) => {
  db.all(
    'SELECT * FROM posts WHERE community = ? ORDER BY created_at DESC',
    [req.params.name],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Create a new post
app.post('/api/posts', (req, res) => {
  const { id, title, content, community, author = 'anonymous' } = req.body;
  
  if (!id || !title || !content || !community) {
    res.status(400).json({ error: 'Missing required post fields' });
    return;
  }
  
  db.run(
    'INSERT INTO posts (id, title, content, community, author, votes) VALUES (?, ?, ?, ?, ?, 0)',
    [id, title, content, community, author],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        id,
        title,
        content,
        community,
        author,
        votes: 0,
        comments: 0
      });
    }
  );
});

// Get a specific post
app.get('/api/posts/:id', (req, res) => {
  db.get('SELECT * FROM posts WHERE id = ?', [req.params.id], (err, post) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    
    // Get comment count
    db.get('SELECT COUNT(*) as count FROM comments WHERE post_id = ?', [req.params.id], (err, result) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      post.comments = result.count;
      res.json(post);
    });
  });
});

// Get comments for a post
app.get('/api/posts/:id/comments', (req, res) => {
  db.all(
    'SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC',
    [req.params.id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Add a comment to a post
app.post('/api/posts/:id/comments', (req, res) => {
  const { id, content, author = 'anonymous' } = req.body;
  const postId = req.params.id;
  
  if (!id || !content) {
    res.status(400).json({ error: 'Missing required comment fields' });
    return;
  }
  
  db.run(
    'INSERT INTO comments (id, post_id, content, author, votes) VALUES (?, ?, ?, ?, 0)',
    [id, postId, content, author],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        id,
        post_id: postId,
        content,
        author,
        votes: 0
      });
    }
  );
});

// Vote on a post
app.post('/api/posts/:id/vote', (req, res) => {
  const { user_id = 'anonymous', vote_type } = req.body;
  const post_id = req.params.id;
  
  if (!vote_type || !['up', 'down'].includes(vote_type)) {
    res.status(400).json({ error: 'Invalid vote type' });
    return;
  }
  
  // Begin transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // Check if user already voted
    db.get(
      'SELECT * FROM votes WHERE user_id = ? AND post_id = ?',
      [user_id, post_id],
      (err, vote) => {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }
        
        let voteChange = 0;
        
        if (!vote) {
          // New vote
          db.run(
            'INSERT INTO votes (user_id, post_id, vote_type) VALUES (?, ?, ?)',
            [user_id, post_id, vote_type]
          );
          voteChange = vote_type === 'up' ? 1 : -1;
        } else if (vote.vote_type === vote_type) {
          // Remove vote if same type
          db.run(
            'DELETE FROM votes WHERE user_id = ? AND post_id = ?',
            [user_id, post_id]
          );
          voteChange = vote_type === 'up' ? -1 : 1;
        } else {
          // Change vote type
          db.run(
            'UPDATE votes SET vote_type = ? WHERE user_id = ? AND post_id = ?',
            [vote_type, user_id, post_id]
          );
          voteChange = vote_type === 'up' ? 2 : -2;
        }
        
        // Update post votes
        db.run(
          'UPDATE posts SET votes = votes + ? WHERE id = ?',
          [voteChange, post_id],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              res.status(500).json({ error: err.message });
              return;
            }
            
            db.get(
              'SELECT * FROM posts WHERE id = ?',
              [post_id],
              (err, post) => {
                if (err) {
                  db.run('ROLLBACK');
                  res.status(500).json({ error: err.message });
                  return;
                }
                
                db.run('COMMIT');
                res.json({
                  ...post,
                  userVoted: voteChange === 0 ? null : vote_type
                });
              }
            );
          }
        );
      }
    );
  });
});

// Create a new community
app.post('/api/communities', (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    res.status(400).json({ error: 'Community name is required' });
    return;
  }
  
  // Validate community name format
  if (!/^[a-z0-9-]+$/.test(name)) {
    res.status(400).json({ error: 'Community name can only contain lowercase letters, numbers, and hyphens' });
    return;
  }
  
  // Check if community already exists
  db.get('SELECT * FROM communities WHERE name = ?', [name], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (row) {
      res.status(409).json({ error: 'A community with this name already exists' });
      return;
    }
    
    // Insert new community
    db.run(
      'INSERT INTO communities (name, description) VALUES (?, ?)',
      [name, description || `Discussions about ${name}`],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        res.status(201).json({
          name,
          description: description || `Discussions about ${name}`,
          created_at: new Date().toISOString()
        });
      }
    );
  });
});

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// Serve React app for all other routes - this must come AFTER all API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access your application at http://localhost:${PORT}`);
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please choose a different port.`);
  } else {
    console.error('Server error:', error);
  }
  process.exit(1);
});

// Close database on app termination
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Closed the database connection');
    process.exit(0);
  });
});
