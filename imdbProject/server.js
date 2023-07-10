const express = require('express');
const session = require('express-session');
const mysql = require('mysql2');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
const port = 3000;

// MySQL bağlantısı oluşturma
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'username',
  password: 'password',
  database: 'movie',
  multipleStatements: true
});

app.set('view engine', 'ejs');

app.set('views', path.join(__dirname, 'views'));

app.use(express.json());

// URL kodlamasını işleme
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'sessionkey123', // Güvenli bir değerle değiştirin
    resave: false,
    saveUninitialized: false
  }));
  

  
  app.get('/register', (req, res) => {
    res.render('register');
  });
  
  app.post('/register', (req, res) => {
    const { username, email, password, firstName, lastName } = req.body;
    
    // Parola şifrelemesi
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const query = 'INSERT INTO User (Username, Email, Password, FirstName, LastName) VALUES (?, ?, ?, ?, ?)';
    const values = [username, email, hashedPassword, firstName, lastName];
    
    connection.query(query, values, (error, results) => {
      if (error) {
        throw error;
      }
    
      res.redirect('/login');
    });
  });

  app.get('/login', (req, res) => {
    res.render('login');
  });
  
  app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    const query = 'SELECT * FROM User WHERE Username = ?';
    
    connection.query(query, [username], (error, results) => {
      if (error) {
        throw error;
      }
    
      if (results.length > 0) {
        const user = results[0];
        
        // Parola karşılaştırması
        const passwordMatch = bcrypt.compareSync(password, user.Password);
    
        if (passwordMatch) {
          // Giriş başarılı
          req.session.userId = user.ID;
          req.session.user = { username }; // İstediğiniz kullanıcı bilgilerini ekleyebilirsiniz
          res.redirect('/');
        } else {
          // Parola yanlış
          res.send('Hatalı kullanıcı adı veya parola');
        }
      } else {
        // Kullanıcı bulunamadı
        res.send('Hatalı kullanıcı adı veya parola');
      }
    });
  });

  const requireLogin = (req, res, next) => {
    if (!req.session.userId) {
      return res.redirect('/login');
    }
  
    next();
  };
  



// Ana sayfa - Tüm film bilgilerini listeleme
app.get('/', (req, res) => {
  connection.query('SELECT * FROM Film', (error, films) => {
    if (error) {
      throw error;
    }
    connection.query('SELECT DISTINCT Genre FROM FilmGenre', (error, genres) => {
      if (error) {
        throw error;
      }
      connection.query('SELECT * FROM FilmGenre', (error, filmGenres) => {
        if (error) {
          throw error;
        }
        
    res.render('index', { films: films, genres: genres , filmGenres: filmGenres, user: req.session.user });
    
  });
});
});
});




// Film detayları
app.get('/film/:filmId', (req, res) => {
    const filmId = req.params.filmId;
  
    connection.query('SELECT * FROM Film WHERE Imdbid = ?', [filmId], (error, filmResults) => {
      if (error) {
        throw error;
      }
  
      if (filmResults.length > 0) {
        // İlgili filmin bilgilerini al

        connection.query('SELECT a.Name,a.ActorID FROM Actor a INNER JOIN FilmActor fa ON a.ActorID = fa.ActorID WHERE fa.Imdbid = ?', [filmId], (error, actorResults) => {
          if (error) {
            throw error;
          }
  
          const aktorler = actorResults;
       

        connection.query('SELECT * FROM Rates WHERE Imdbid = ?', [filmId], (error, yorumResults) => {
          if (error) {
            throw error;
          }
  
          // Filmin yorumlarını al
  
          const film = filmResults[0];
          const yorumlar = yorumResults;
  
          res.render('film', { film, aktorler, yorumlar, user: req.session.user });
        });
      });
      } else {
        res.send('Film bulunamadı');
      }
    });
  });
  
  // Yorum ekleme
  app.post('/film/:filmId/yorum', (req, res) => {
    const filmId = req.params.filmId;
    
    const kullaniciAdi = req.body.kullaniciAdi;
    const yorumMetni = req.body.yorumMetni;
    const oy = req.body.oy;
  
    const query = 'INSERT INTO Rates (Imdbid, Username, Comment, Rating) VALUES (?, ?, ?, ?)';
    const values = [filmId, kullaniciAdi, yorumMetni, oy];
  
    connection.query(query, values, (error, results) => {
      if (error) {
        throw error;
      }
  
      res.redirect('/film/' + filmId);
    });
  });
  
  app.get('/actor/:actorId', (req, res) => {
    const actorId = req.params.actorId;
  
    connection.query('SELECT * FROM Actor WHERE ActorID = ?', [actorId], (error, actorResults) => {
      if (error) {
        throw error;
      }
  
      if (actorResults.length > 0) {
        // İlgili aktörün bilgilerini al
        const actor = actorResults[0];
  
        connection.query('SELECT f.* FROM Film f INNER JOIN FilmActor fa ON f.Imdbid = fa.Imdbid WHERE fa.ActorID = ?', [actorId], (error, filmResults) => {
          if (error) {
            throw error;
          }
  
          // Oynadığı filmlerin bilgilerini al
          const filmler = filmResults;
  
          res.render('actor', { actor, filmler, user: req.session.user });
        });
      } else {
        res.send('Aktör bulunamadı');
      }
    });
  });
  

  app.get('/top-rated-films', (req, res) => {
    // Veritabanı sorgusunu oluşturun
    
    const query = `
    SELECT f.Title AS film_name, f.Poster, AVG(r.Rating) AS average_rating
    FROM Film f
    JOIN Rates r ON f.Imdbid = r.Imdbid
    GROUP BY f.Imdbid, f.Title
    ORDER BY average_rating DESC
    LIMIT 10
    `;
  
    // Veritabanı sorgusunu çalıştırın
    connection.query(query, (error, results) => {
      if (error) {
        console.error('Sorgu hatası:', error);
        return res.status(500).send('Bir şeyler yanlış gitti!');
      }
  
      // Sorgu sonuçlarını `topRatedFilms` adlı değişkene atayın
      const topRatedFilms = results;
  
      // top-rated-films.ejs dosyasını kullanarak sayfayı render edin ve verileri aktarın
      res.render('top-rated-films', { topRatedFilms, user: req.session.user });
    });
  });
  

  app.get('/top-actors', (req, res) => {
    // Veritabanı sorgusunu oluşturun
    const query = `
    SELECT actor_name, genre_count, genres_played
FROM (
    SELECT a.Name AS actor_name, COUNT(DISTINCT fg.Genre) AS genre_count, GROUP_CONCAT(DISTINCT fg.Genre SEPARATOR ', ') AS genres_played
    FROM Actor a
    JOIN FilmActor fa ON a.ActorID = fa.ActorID
    JOIN FilmGenre fg ON fa.Imdbid = fg.Imdbid
    GROUP BY a.ActorID, a.Name
) AS nested_query
ORDER BY genre_count DESC;
  `;
  
    // Veritabanı sorgusunu çalıştırın
    connection.query(query, (error, results) => {
      if (error) {
        console.error('Sorgu hatası:', error);
        return res.status(500).send('Bir şeyler yanlış gitti!');
      }
  
      // Sorgu sonuçlarını `topActors` adlı değişkene atayın
      const topActors = results;
  
      // top-actors.ejs dosyasını kullanarak sayfayı render edin ve verileri aktarın
      res.render('top-actors', { topActors, user: req.session.user });
    });
  });
  

  app.get('/user/profile', function(req, res) {
    if (!req.session.user) {
      // Kullanıcı giriş yapmamışsa, giriş sayfasına yönlendir
      res.redirect('/login');
      return;
    }
    
    // Kullanıcının puanladığı filmleri kendi verdiği puana göre sırala
    const query = `
    SELECT f.Title, r.Rating, f.Imdbrating
    FROM Film f
    JOIN Rates r ON f.Imdbid = r.Imdbid
    WHERE r.Username = ?
    ORDER BY r.Rating DESC, f.Imdbrating DESC;
    `;
    
    const userId = req.session.user.username; // Kullanıcının ID'sini alın (bu örnekte req.user.id olarak varsayıyoruz)
    
    // Veritabanı sorgusunu çalıştırın ve sonucu `userRatings` adlı değişkene atayın
    connection.query(query, [userId], function(err, userRatings) {
      if (err) {
        // Hata oluştuğunda hata sayfasına yönlendir
        throw err;
        
      }
      //Oyladığı filmler arasında en çok yer alan aktörler
      connection.query('SELECT A.Name as ActorName, COUNT(*) AS FilmCount, GROUP_CONCAT(F.Title) AS Films'+
                       ' FROM Rates R JOIN Film F ON R.Imdbid = F.Imdbid JOIN FilmActor FA ON F.Imdbid = FA.Imdbid JOIN Actor A ON FA.ActorID = A.ActorID'+
                       ' WHERE Username = ? GROUP BY A.ActorID ORDER BY FilmCount DESC LIMIT 5', [userId], (error, topActors) => {
        if (error) {
          throw error;
        }

      // Kullanıcı profili sayfasını render edin ve userRatings verisini aktarın
      res.render('user-profile.ejs', { userRatings: userRatings,topActors: topActors, user: req.session.user });
    });
  });
});

  app.get('/popular-actors', (req, res) => {
    // Son 10 yılda çok film çeken aktörleri bulmak için gerekli veritabanı sorgularını burada gerçekleştirin
    connection.query(`
      SELECT Actor.Name AS ActorName, COUNT(*) AS FilmCount, GROUP_CONCAT(Film.Title SEPARATOR ', ') AS Films
      FROM Actor
      JOIN FilmActor ON Actor.ActorID = FilmActor.ActorID
      JOIN Film ON FilmActor.Imdbid = Film.Imdbid
      WHERE Film.Year >= YEAR(CURDATE()) - 10
      GROUP BY Actor.ActorID
      HAVING COUNT(*) > 2
      ORDER BY FilmCount DESC
    `, (error, results) => {
      if (error) {
        throw error;
      }
  
      // Elde edilen verileri "popular-actors" şablonuna render ederek istemciye gönderin
      res.render('popular-actors', { actors: results });
    });
  });
  


  // Kullanıcı çıkışı
app.get('/logout', (req, res) => {
    req.session.destroy(); // Oturumu sonlandır
  
    res.redirect('/'); // Ana sayfaya yönlendir
  });
  

app.use(express.static(path.join(__dirname, 'public')));

// Sunucuyu dinleme
app.listen(port, () => {
    console.log(`Uygulama ${port} portunda çalışıyor.`);
  });
