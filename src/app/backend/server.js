const express    = require('express');
const mysql      = require('mysql');
const bodyParser = require('body-parser');
const cors       = require('cors');
require('dotenv').config();
const nodemailer = require('nodemailer');   // <-- AÑADE ESTA LÍNEA


const app  = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

const db = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : '',           // agrega tu password si lo tienes
  database : 'proyectoedu',
  port     : 3306
});

db.connect(err => {
  if (err) throw err;
  console.log('Conexión a la base de datos establecida');
});

////////// PROFESORES //////////

// Listar todos los profesores con sus instituciones
app.get('/profesores', (req, res) => {
  const sql = `
    SELECT
      p.idProfesorSAANEE      AS idProfesor,
      p.Correo,
      p.NombreProfesorSAANEE  AS NombreProfesor,
      p.Clave,
      p.TelefonoSAANEE        AS TelefonoProf,
      GROUP_CONCAT(pi.idInstitucionEducativa) AS Instituciones
    FROM profesores_saanee p
    LEFT JOIN profesores_saanee_institucion pi
      ON p.idProfesorSAANEE = pi.idProfesorSAANEE
    GROUP BY p.idProfesorSAANEE
    ORDER BY p.NombreProfesorSAANEE ASC
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error al obtener profesores:', err);
      return res.status(500).json({ error: 'Error al obtener profesores' });
    }
    const profs = results.map(r => ({
      idProfesor:    r.idProfesor,
      Correo:        r.Correo,
      NombreProfesor:r.NombreProfesor,
      Clave:         r.Clave,
      TelefonoProf:  r.TelefonoProf,
      Instituciones: r.Instituciones
        ? r.Instituciones.split(',').map(x => parseInt(x, 10))
        : []
    }));
    res.json(profs);
  });
});

// Buscar un profesor por nombre (LIKE)
app.get('/buscar-profesor', (req, res) => {
  const { nombreProfesor } = req.query;
  if (!nombreProfesor) {
    return res.status(400).send('Se requiere nombreProfesor');
  }
  const sql1 = `
    SELECT *
    FROM profesores_saanee
    WHERE NombreProfesorSAANEE LIKE ?
    LIMIT 1
  `;
  db.query(sql1, [`%${nombreProfesor}%`], (err, results) => {
    if (err) {
      console.error('Error al buscar profesor:', err);
      return res.status(500).json({ error: 'Error interno' });
    }
    if (results.length === 0) {
      return res.status(404).send('Profesor no encontrado');
    }
    const prof = results[0];
    const sql2 = `
      SELECT idInstitucionEducativa
      FROM profesores_saanee_institucion
      WHERE idProfesorSAANEE = ?
    `;
    db.query(sql2, [prof.idProfesorSAANEE], (err2, rows) => {
      if (err2) {
        console.error('Error al obtener instituciones:', err2);
        return res.status(500).json({ error: 'Error interno' });
      }
      res.json({
        idProfesor:    prof.idProfesorSAANEE,
        Correo:        prof.Correo,
        NombreProfesor:prof.NombreProfesorSAANEE,
        Clave:         prof.Clave,
        TelefonoProf:  prof.TelefonoSAANEE,
        Instituciones: rows.map(r => r.idInstitucionEducativa)
      });
    });
  });
});

// Registrar un profesor y sus instituciones
app.post('/registrar-profesor', (req, res) => {
  const { Correo, NombreProfesorSAANEE, Clave, TelefonoSAANEE, Instituciones } = req.body;
  if (!Correo || !NombreProfesorSAANEE || !Clave || !TelefonoSAANEE || !Array.isArray(Instituciones) || !Instituciones.length) {
    return res.status(400).send('Todos los campos son obligatorios y se requieren instituciones');
  }

  const sqlIns = `
    INSERT INTO profesores_saanee (Correo, NombreProfesorSAANEE, Clave, TelefonoSAANEE)
    VALUES (?, ?, ?, ?)
  `;
  db.query(sqlIns, [Correo, NombreProfesorSAANEE, Clave, TelefonoSAANEE], (err, result) => {
    if (err) {
      console.error('Error al registrar profesor:', err);
      return res.status(500).json({ error: 'Error al registrar profesor' });
    }
    const idProf = result.insertId;
    const vals   = Instituciones.map(idInst => [idProf, idInst]);
    const sqlRel = `
      INSERT INTO profesores_saanee_institucion (idProfesorSAANEE, idInstitucionEducativa)
      VALUES ?
    `;
    db.query(sqlRel, [vals], err2 => {
      if (err2) {
        console.error('Error al registrar relaciones:', err2);
        return res.status(500).json({ error: 'Error al registrar relaciones' });
      }
      res.json({ message: 'Profesor registrado con éxito' });
    });
  });
});

// Actualizar profesor y sus instituciones
app.put('/actualizar-profesor', (req, res) => {
  const { idProfesorSAANEE, Correo, NombreProfesorSAANEE, Clave, TelefonoSAANEE, Instituciones } = req.body;
  if (!idProfesorSAANEE || !Correo || !NombreProfesorSAANEE || !Clave || !TelefonoSAANEE || !Array.isArray(Instituciones) || !Instituciones.length) {
    return res.status(400).send('Todos los campos son obligatorios');
  }

  const sqlUpd = `
    UPDATE profesores_saanee
    SET Correo=?, NombreProfesorSAANEE=?, Clave=?, TelefonoSAANEE=?
    WHERE idProfesorSAANEE=?
  `;
  db.query(sqlUpd, [Correo, NombreProfesorSAANEE, Clave, TelefonoSAANEE, idProfesorSAANEE], err => {
    if (err) {
      console.error('Error al actualizar profesor:', err);
      return res.status(500).json({ error: 'Error al actualizar profesor' });
    }
    const sqlDel = `DELETE FROM profesores_saanee_institucion WHERE idProfesorSAANEE=?`;
    db.query(sqlDel, [idProfesorSAANEE], err2 => {
      if (err2) {
        console.error('Error al eliminar relaciones:', err2);
        return res.status(500).json({ error: 'Error al actualizar relaciones' });
      }
      const vals   = Instituciones.map(idInst => [idProfesorSAANEE, idInst]);
      const sqlIns = `
        INSERT INTO profesores_saanee_institucion (idProfesorSAANEE, idInstitucionEducativa)
        VALUES ?
      `;
      db.query(sqlIns, [vals], err3 => {
        if (err3) {
          console.error('Error al insertar relaciones:', err3);
          return res.status(500).json({ error: 'Error al actualizar relaciones' });
        }
        res.json({ message: 'Profesor actualizado con éxito' });
      });
    });
  });
});

////////// INSTITUCIONES EDUCATIVAS //////////

// Instituciones sin asignar
app.get('/instituciones', (req, res) => {
  const sql = `
    SELECT idInstitucionEducativa, NombreInstitucion
    FROM instituciones_educativas
    WHERE idInstitucionEducativa NOT IN (
      SELECT idInstitucionEducativa
      FROM profesores_saanee_institucion
    )
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error al obtener instituciones:', err);
      return res.status(500).json({ error: 'Error al obtener instituciones' });
    }
    res.json(results);
  });
});

// Todas las instituciones
app.get('/instituciones-all', (req, res) => {
  db.query(
    'SELECT idInstitucionEducativa, NombreInstitucion FROM instituciones_educativas',
    (err, results) => {
      if (err) {
        console.error('Error al obtener instituciones:', err);
        return res.status(500).json({ error: 'Error al obtener instituciones' });
      }
      res.json(results);
    }
  );
});

// Instituciones usadas por otros profesores (para editar)
app.get('/instituciones-no-editables', (req, res) => {
  const { idProfesorSAANEE } = req.query;
  if (!idProfesorSAANEE) {
    return res.status(400).send('Se requiere idProfesorSAANEE');
  }
  const sql = `
    SELECT idInstitucionEducativa
    FROM profesores_saanee_institucion
    WHERE idProfesorSAANEE <> ?
  `;
  db.query(sql, [idProfesorSAANEE], (err, rows) => {
    if (err) {
      console.error('Error al obtener instituciones no editables:', err);
      return res.status(500).json({ error: 'Error al obtener instituciones no editables' });
    }
    res.json(rows.map(r => r.idInstitucionEducativa));
  });
});

// Instituciones de un profesor (por id o correo)
app.get('/instituciones-profesor', (req, res) => {
  const { idProfesorSAANEE, correo } = req.query;
  if (!idProfesorSAANEE && !correo) {
    return res.status(400).send('Se requiere idProfesorSAANEE o correo');
  }
  const sqlP = idProfesorSAANEE
    ? 'SELECT * FROM profesores_saanee WHERE idProfesorSAANEE=?'
    : 'SELECT * FROM profesores_saanee WHERE Correo=?';
  const param = idProfesorSAANEE || correo;
  db.query(sqlP, [param], (err, results) => {
    if (err) {
      console.error('Error al buscar profesor:', err);
      return res.status(500).json({ error: 'Error interno' });
    }
    if (results.length === 0) {
      return res.status(404).send('Profesor no encontrado');
    }
    const prof = results[0];
    db.query(
      'SELECT idInstitucionEducativa FROM profesores_saanee_institucion WHERE idProfesorSAANEE=?',
      [prof.idProfesorSAANEE],
      (err2, rows2) => {
        if (err2) {
          console.error('Error al obtener instituciones:', err2);
          return res.status(500).json({ error: 'Error interno' });
        }
        res.json({
          idProfesor:     prof.idProfesorSAANEE,
          Correo:         prof.Correo,
          NombreProfesor: prof.NombreProfesorSAANEE,
          Clave:          prof.Clave,
          TelefonoProf:   prof.TelefonoSAANEE,
          Instituciones:  rows2.map(r => r.idInstitucionEducativa)
        });
      }
    );
  });
});

// Crear institución
app.post('/institucion', (req, res) => {
  const { NombreInstitucion } = req.body;
  if (!NombreInstitucion) {
    return res.status(400).json({ error: 'Nombre de institución es obligatorio' });
  }
  db.query(
    'INSERT INTO instituciones_educativas (NombreInstitucion) VALUES (?)',
    [NombreInstitucion],
    (err, result) => {
      if (err) {
        console.error('Error al crear institución:', err);
        return res.status(500).json({ error: 'Error interno al crear institución' });
      }
      res.status(201).json({
        idInstitucionEducativa: result.insertId,
        NombreInstitucion
      });
    }
  );
});

// Editar institución
app.put('/institucion/:id', (req, res) => {
  const { id } = req.params;
  const { NombreInstitucion } = req.body;
  if (!NombreInstitucion) {
    return res.status(400).json({ error: 'Nombre de institución es obligatorio' });
  }
  db.query(
    'UPDATE instituciones_educativas SET NombreInstitucion=? WHERE idInstitucionEducativa=?',
    [NombreInstitucion, id],
    err => {
      if (err) {
        console.error('Error al editar institución:', err);
        return res.status(500).json({ error: 'Error interno al editar institución' });
      }
      res.json({ message: 'Institución actualizada con éxito' });
    }
  );
});

////////// ESTUDIANTE //////////
app.post('/registrar-estudiante', (req, res) => {
  const {
    ApellidosNombres,
    FechaNacimiento,  // "dd/mm/yyyy"
    Edad,
    DNI,
    GradoSeccion,
    TipoDiscapacidad,
    DocumentoSustentatorio,
    DocumentoInclusiva,
    IPP,
    PEP,
    idInstitucionEducativa  // nuevo
  } = req.body;

  if (!ApellidosNombres || !FechaNacimiento || !Edad || !DNI || !GradoSeccion || !idInstitucionEducativa) {
    return res.status(400).json({ error: 'Faltan campos obligatorios o institución educativa' });
  }

  const parts = FechaNacimiento.split('/');
  if (parts.length !== 3) return res.status(400).json({ error: 'Formato de Fecha de Nacimiento inválido' });
  const fechaISO = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
  const ippValue = (IPP === true || IPP === 'Si') ? 'Si' : 'No';
  const pepValue = (PEP === true || PEP === 'Si') ? 'Si' : 'No';

  const sql = `
    INSERT INTO estudiantes
      (ApellidosNombres, FechaNacimiento, Edad, DNI, GradoSeccion,
       TipoDiscapacidad, DocumentoSustentatorio, DocumentoInclusiva,
       IPP, PEP, idInstitucionEducativa)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.query(sql, [
    ApellidosNombres,
    fechaISO,
    Edad,
    DNI,
    GradoSeccion,
    TipoDiscapacidad || null,
    DocumentoSustentatorio || null,
    DocumentoInclusiva || null,
    ippValue,
    pepValue,
    idInstitucionEducativa
  ], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error interno al registrar estudiante' });
    res.status(201).json({ message: 'Estudiante registrado', idEstudiante: result.insertId });
  });
});

app.get('/estudiantes', (req, res) => {
  let sql = `
    SELECT
      idEstudiante,
      ApellidosNombres,
      DATE_FORMAT(FechaNacimiento, '%d/%m/%Y') AS FechaNacimiento,
      Edad,
      DNI,
      GradoSeccion,
      TipoDiscapacidad,
      DocumentoSustentatorio,
      DocumentoInclusiva,
      IPP,
      PEP,
      idInstitucionEducativa
    FROM estudiantes`;
  const params = [];
  if (req.query.idInstitucionEducativa) {
    sql += ` WHERE idInstitucionEducativa = ?`;
    params.push(req.query.idInstitucionEducativa);
  }
  sql += ` ORDER BY idEstudiante ASC`;

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: 'Error interno al obtener estudiantes' });
    res.status(200).json(results);
  });
});

app.get('/buscar-estudiante', (req, res) => {
  const { idEstudiante, DNI } = req.query;
  if (!idEstudiante && !DNI) {
    return res.status(400).send('Se requiere idEstudiante o DNI');
  }

  // Elegimos campo de búsqueda
  let sqlSelect = 'SELECT * FROM estudiantes WHERE ';
  let param;
  if (idEstudiante) {
    sqlSelect += 'idEstudiante = ?';
    param = idEstudiante;
  } else {
    sqlSelect += 'DNI = ?';
    param = DNI;
  }

  db.query(sqlSelect, [param], (err, results) => {
    if (err) {
      console.error('Error al buscar estudiante:', err);
      return res.status(500).json({ error: 'Error interno' });
    }
    if (results.length === 0) {
      return res.status(404).send('Estudiante no encontrado');
    }
    const est = results[0];
    // Obtener sus campos formateados
    const sqlFormat = `
      SELECT
        idEstudiante,
        ApellidosNombres,
        DATE_FORMAT(FechaNacimiento, '%d/%m/%Y') AS FechaNacimiento,
        Edad,
        DNI,
        GradoSeccion,
        TipoDiscapacidad,
        DocumentoSustentatorio,
        DocumentoInclusiva,
        IPP,
        PEP
      FROM estudiantes
      WHERE idEstudiante = ?
    `;
    db.query(sqlFormat, [est.idEstudiante], (err2, formatted) => {
      if (err2) {
        console.error('Error al formatear estudiante:', err2);
        return res.status(500).json({ error: 'Error interno' });
      }
      res.json(formatted[0]);
    });
  });
});

// Endpoint para actualizar un estudiante
app.put('/actualizar-estudiante', (req, res) => {
  const {
    idEstudiante,
    ApellidosNombres,
    FechaNacimiento,
    Edad,
    DNI,
    GradoSeccion,
    TipoDiscapacidad,
    DocumentoSustentatorio,
    DocumentoInclusiva,
    IPP,
    PEP
  } = req.body;

  if (!idEstudiante || !ApellidosNombres || !FechaNacimiento || !Edad || !DNI || !GradoSeccion) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  // convertir dd/mm/yyyy → ISO
  const parts = FechaNacimiento.split('/');
  if (parts.length !== 3) {
    return res.status(400).json({ error: 'Formato de fecha inválido' });
  }
  const fechaISO = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
  const ippValue = (IPP === 'Si') ? 'Si' : 'No';
  const pepValue = (PEP === 'Si') ? 'Si' : 'No';

  const sql = `
    UPDATE estudiantes SET
      ApellidosNombres     = ?,
      FechaNacimiento      = ?,
      Edad                 = ?,
      DNI                  = ?,
      GradoSeccion         = ?,
      TipoDiscapacidad     = ?,
      DocumentoSustentatorio = ?,
      DocumentoInclusiva     = ?,
      IPP                  = ?,
      PEP                  = ?
    WHERE idEstudiante = ?
  `;
  const params = [
    ApellidosNombres,
    fechaISO,
    Edad,
    DNI,
    GradoSeccion,
    TipoDiscapacidad || null,
    DocumentoSustentatorio || null,
    DocumentoInclusiva || null,
    ippValue,
    pepValue,
    idEstudiante
  ];

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error('Error al actualizar estudiante:', err);
      return res.status(500).json({ error: 'Error interno al actualizar' });
    }
    res.json({ message: 'Estudiante actualizado con éxito' });
  });
});


app.delete('/eliminar-estudiante/:id', (req, res) => {
  const id = req.params.id;
  const deleteDocentes = 'DELETE FROM docentes_estudiante WHERE idEstudiante = ?';
  const deleteFamilias = 'DELETE FROM familia_estudiante WHERE idEstudiante = ?';
  const deleteEstudiante = 'DELETE FROM estudiantes WHERE idEstudiante = ?';

  // Ejemplo sin transacción para claridad
  db.query(deleteDocentes, [id], err => {
    if (err) {
      console.error('Error al eliminar asignaciones de docente:', err);
      return res.status(500).json({ error: 'Error interno al eliminar asignaciones de docente' });
    }
    db.query(deleteFamilias, [id], err2 => {
      if (err2) {
        console.error('Error al eliminar familia:', err2);
        return res.status(500).json({ error: 'Error interno al eliminar familia' });
      }
      db.query(deleteEstudiante, [id], (err3, result) => {
        if (err3) {
          console.error('Error al eliminar estudiante:', err3);
          return res.status(500).json({ error: 'Error interno al eliminar estudiante' });
        }
        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Estudiante no encontrado' });
        }
        res.json({ message: 'Estudiante eliminado con éxito' });
      });
    });
  });
});


////////// ESTUDIANTE CON DOCENTE //////////
app.get('/estudiantes-con-docente', (req, res) => {
  const sql = `SELECT DISTINCT idEstudiante FROM docentes_estudiante`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Error interno' });
    res.json(results.map(r => r.idEstudiante));
  });
});

app.get('/docentes-estudiante', (req, res) => {
  const { idInstitucionEducativa, nombreDocente } = req.query;
  let sql = `
    SELECT
      de.idDocente,
      de.idEstudiante,
      e.ApellidosNombres AS NombreEstudiante,
      de.NombreDocente,
      de.DNIDocente,
      de.Email,
      de.Telefono,
      de.GradoSeccionLabora
    FROM docentes_estudiante de
    JOIN estudiantes e ON de.idEstudiante = e.idEstudiante
  `;
  const where = [];
  const params = [];

  if (idInstitucionEducativa) {
    where.push('de.idInstitucionEducativa = ?');
    params.push(idInstitucionEducativa);
  }
  if (nombreDocente) {
    where.push('de.NombreDocente LIKE ?');
    params.push(`%${nombreDocente}%`);
  }
  if (where.length) {
    sql += ' WHERE ' + where.join(' AND ');
  }
  sql += ' ORDER BY de.idDocente ASC';

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error al obtener docentes:', err);
      return res.status(500).json({ error: 'Error interno' });
    }
    res.json(results);
  });
});


// --- Listar docentes con filtro opcional por nombre y/o institución ---
// app.get('/docentes-estudiante', (req, res) => {
//   const { idInstitucionEducativa, nombreDocente } = req.query;
//   let sql = `
//     SELECT
//       de.idDocente,
//       de.idEstudiante,
//       e.ApellidosNombres AS NombreEstudiante,
//       de.NombreDocente,
//       de.DNIDocente,
//       de.Email,
//       de.Telefono,
//       de.GradoSeccionLabora
//     FROM docentes_estudiante de
//     JOIN estudiantes e ON de.idEstudiante = e.idEstudiante
//   `;
//   const params = [];
//   const where = [];

//   if (idInstitucionEducativa) {
//     where.push('de.idInstitucionEducativa = ?');
//     params.push(idInstitucionEducativa);
//   }
//   if (nombreDocente) {
//     where.push('de.NombreDocente LIKE ?');
//     params.push(`%${nombreDocente}%`);
//   }
//   if (where.length) {
//     sql += ' WHERE ' + where.join(' AND ');
//   }
//   sql += ' ORDER BY de.idDocente ASC';

//   db.query(sql, params, (err, results) => {
//     if (err) {
//       console.error('Error al obtener docentes:', err);
//       return res.status(500).json({ error: 'Error interno' });
//     }
//     res.json(results);
//   });
// });


// --- Registrar un nuevo docente-Estudiante ---
app.post('/registrar-docente', (req, res) => {
  const { idEstudiante, NombreDocente, DNIDocente, Email, Telefono, GradoSeccionLabora } = req.body;
  if (!idEstudiante || !NombreDocente || !DNIDocente || !Email) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  // 1) Obtener la institución del estudiante
  const sqlInst = `
    SELECT idInstitucionEducativa
    FROM estudiantes
    WHERE idEstudiante = ?
    LIMIT 1
  `;
  db.query(sqlInst, [idEstudiante], (err1, rows1) => {
    if (err1) {
      console.error('Error obteniendo institución del estudiante:', err1);
      return res.status(500).json({ error: 'Error interno al obtener institución' });
    }
    if (rows1.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    const idInstitucionEducativa = rows1[0].idInstitucionEducativa;

    // 2) Insertar la fila incluyendo idInstitucionEducativa
    const sql = `
      INSERT INTO docentes_estudiante
        (idEstudiante, NombreDocente, DNIDocente, Email, Telefono, GradoSeccionLabora, idInstitucionEducativa)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(sql, [
      idEstudiante,
      NombreDocente,
      DNIDocente,
      Email,
      Telefono || null,
      GradoSeccionLabora || null,
      idInstitucionEducativa
    ], (err2, result) => {
      if (err2) {
        console.error('Error interno al registrar docente:', err2);
        return res.status(500).json({ error: 'Error interno al registrar docente' });
      }
      res.status(201).json({ idDocente: result.insertId });
    });
  });
});

// --- Actualizar docente + asignaciones (añade/quita según array) ---
app.put('/actualizar-docente', (req, res) => {
  const {
    DNIDocente,
    NombreDocente,
    Email,
    Telefono,
    GradoSeccionLabora,
    idEstudiante  // array de IDs
  } = req.body;

  if (!DNIDocente || !NombreDocente || !Email || !Array.isArray(idEstudiante)) {
    return res.status(400).json({ error: 'Faltan campos obligatorios o idEstudiante no es array' });
  }

  // 0) Obtener instituciones para todos los estudiantes de entrada
  const sqlInst = `
    SELECT idEstudiante, idInstitucionEducativa
    FROM estudiantes
    WHERE idEstudiante IN (?)
  `;
  db.query(sqlInst, [idEstudiante], (err0, instRows) => {
    if (err0) {
      console.error('Error obteniendo instituciones:', err0);
      return res.status(500).json({ error: 'Error interno al obtener instituciones' });
    }
    const instMap = new Map(instRows.map(r => [r.idEstudiante, r.idInstitucionEducativa]));

    // 1. Traer asignaciones actuales
    const sqlCurrent = `
      SELECT idDocente, idEstudiante
      FROM docentes_estudiante
      WHERE DNIDocente = ?
    `;
    db.query(sqlCurrent, [DNIDocente], (err1, currentRows) => {
      if (err1) {
        console.error('Error obteniendo asignaciones actuales:', err1);
        return res.status(500).json({ error: 'Error interno' });
      }

      const currentMap = new Map(currentRows.map(r => [r.idEstudiante, r.idDocente]));
      // IDs a eliminar y a insertar
      const toDelete = currentRows
        .filter(r => !idEstudiante.includes(r.idEstudiante))
        .map(r => r.idDocente);
      const toAdd = idEstudiante.filter(id => !currentMap.has(id));

      // 2. Actualizar campos de las filas existentes
      const sqlUpdateAll = `
        UPDATE docentes_estudiante
        SET NombreDocente = ?, Email = ?, Telefono = ?, GradoSeccionLabora = ?
        WHERE DNIDocente = ?
      `;
      db.query(sqlUpdateAll, [
        NombreDocente,
        Email,
        Telefono || null,
        GradoSeccionLabora || null,
        DNIDocente
      ], (err2) => {
        if (err2) {
          console.error('Error actualizando datos existentes:', err2);
          return res.status(500).json({ error: 'Error interno al actualizar datos' });
        }

        // 3. Eliminar las asignaciones sobrantes
        const proceedInsert = () => {
          if (!toAdd.length) {
            return res.json({ message: 'Docente actualizado sin nuevos registros' });
          }
          // 4. Insertar nuevas asignaciones, incluyendo idInstitucionEducativa
          const vals = toAdd.map(idEst => [
            idEst,
            NombreDocente,
            DNIDocente,
            Email,
            Telefono || null,
            GradoSeccionLabora || null,
            instMap.get(idEst)  // la institución correcta
          ]);
          const sqlIns = `
            INSERT INTO docentes_estudiante
              (idEstudiante, NombreDocente, DNIDocente, Email, Telefono, GradoSeccionLabora, idInstitucionEducativa)
            VALUES ?
          `;
          db.query(sqlIns, [vals], (err3) => {
            if (err3) {
              console.error('Error insertando nuevas asignaciones:', err3);
              return res.status(500).json({ error: 'Error interno al insertar nuevas asignaciones' });
            }
            res.json({ message: 'Docente y asignaciones actualizadas con éxito' });
          });
        };

        if (toDelete.length) {
          const sqlDel = `DELETE FROM docentes_estudiante WHERE idDocente IN (?)`;
          db.query(sqlDel, [toDelete], (errDel) => {
            if (errDel) {
              console.error('Error eliminando asignaciones:', errDel);
              return res.status(500).json({ error: 'Error interno al eliminar asignaciones' });
            }
            proceedInsert();
          });
        } else {
          proceedInsert();
        }
      });
    });
  });
});

app.delete('/eliminar-docente/:id', (req, res) => {
  const id = req.params.id;

  // 1) Buscamos el DNIDocente asociado al idDocente que nos manda el front
  const sqlSelectDni = `
    SELECT DNIDocente
    FROM docentes_estudiante
    WHERE idDocente = ?
    LIMIT 1
  `;
  db.query(sqlSelectDni, [id], (err0, rows0) => {
    if (err0) {
      console.error('Error al buscar DNIDocente para eliminación:', err0);
      return res.status(500).json({ error: 'Error interno al buscar docente' });
    }
    if (rows0.length === 0) {
      // No existe ninguna fila con ese idDocente
      return res.status(404).json({ error: 'Docente no encontrado' });
    }

    const dni = rows0[0].DNIDocente;

    // 2) Eliminamos todas las filas (asignaciones) que tengan ese mismo DNIDocente
    const sqlDeleteAll = `
      DELETE FROM docentes_estudiante
      WHERE DNIDocente = ?
    `;
    db.query(sqlDeleteAll, [dni], (err1, result1) => {
      if (err1) {
        console.error('Error al eliminar todas las asignaciones del docente:', err1);
        return res.status(500).json({ error: 'Error interno al eliminar docente' });
      }
      if (result1.affectedRows === 0) {
        // Teóricamente no debería pasar porque sabemos que había al menos 1 fila;
        // pero por si acaso:
        return res.status(404).json({ error: 'Docente no encontrado o ya eliminado' });
      }
      // Si llegamos aquí, borramos todas las filas que corresponder al mismo docente
      res.json({
        message: 'Docente eliminado con éxito. Las filas relacionadas quedaron libres para nueva asignación.'
      });
    });
  });
});

app.get('/buscar-docente', (req, res) => {
  const { nombreDocente } = req.query;
  if (!nombreDocente) {
    return res.status(400).send('Se requiere nombreDocente');
  }

  // 1) Obtener el DNIDocente del primer registro con ese nombre
  const sqlBase = `
    SELECT DNIDocente
    FROM docentes_estudiante
    WHERE NombreDocente = ?
    LIMIT 1
  `;
  db.query(sqlBase, [nombreDocente], (err, baseRows) => {
    if (err) {
      console.error('Error en buscar-docente (base):', err);
      return res.status(500).json({ error: 'Error interno' });
    }
    if (baseRows.length === 0) {
      return res.status(404).send('Docente no encontrado');
    }
    const dni = baseRows[0].DNIDocente;

    // 2) Traer todas las filas con ese DNIDocente
    const sqlAll = `
      SELECT
        idDocente,
        idEstudiante,
        NombreDocente,
        DNIDocente,
        Email,
        Telefono,
        GradoSeccionLabora
      FROM docentes_estudiante
      WHERE DNIDocente = ?
    `;
    db.query(sqlAll, [dni], (err2, rows) => {
      if (err2) {
        console.error('Error en buscar-docente (all):', err2);
        return res.status(500).json({ error: 'Error interno' });
      }
      // Construimos la respuesta que el cliente espera:
      const any = rows[0];
      res.json({
        DNIDocente: any.DNIDocente,
        NombreDocente: any.NombreDocente,
        Email: any.Email,
        Telefono: any.Telefono,
        GradoSeccionLabora: any.GradoSeccionLabora,
        idEstudiante: rows.map(r => r.idEstudiante)
      });
    });
  });
});

// --- Eliminar una familia ---
app.delete('/eliminar-familia/:id', (req, res) => {
  const id = req.params.id;
  const deleteSql = 'DELETE FROM familia_estudiante WHERE idFamilia = ?';

  db.query(deleteSql, [id], (err, result) => {
    if (err) {
      console.error('Error al eliminar familia:', err);
      return res.status(500).json({ error: 'Error interno al eliminar familia' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Familia no encontrada' });
    }
    return res.json({ message: 'Familia eliminada con éxito' });
  });
});



// --- Obtener familias, opcionalmente filtradas por institución educativa ---
app.get('/familias-estudiante', (req, res) => {
  const { idInstitucionEducativa } = req.query;
  let sql = `
    SELECT
      fe.idFamilia,
      fe.idEstudiante,
      e.ApellidosNombres AS NombreEstudiante,
      fe.NombreMadreApoderado,
      fe.DNI,
      fe.Direccion,
      fe.Telefono,
      fe.Ocupacion
    FROM familia_estudiante fe
    JOIN estudiantes e ON fe.idEstudiante = e.idEstudiante
  `;
  const params = [];

  if (idInstitucionEducativa) {
    sql += ` WHERE fe.idInstitucionEducativa = ?`;
    params.push(idInstitucionEducativa);
  }
  sql += ` ORDER BY fe.idFamilia ASC`;

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error al obtener familias:', err);
      return res.status(500).json({ error: 'Error al obtener familias' });
    }
    res.status(200).json(results);
  });
});


// --- Registrar nueva familia para un estudiante, validando IE del estudiante ---
app.post('/registrar-familia', (req, res) => {
  const { idEstudiante, NombreMadreApoderado, DNI, Direccion, Telefono, Ocupacion } = req.body;
  if (!idEstudiante || !NombreMadreApoderado || !DNI) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  // 1) Obtenemos la institución del estudiante
  const sqlInst = `
    SELECT idInstitucionEducativa
    FROM estudiantes
    WHERE idEstudiante = ?
    LIMIT 1
  `;
  db.query(sqlInst, [idEstudiante], (err1, rows1) => {
    if (err1) {
      console.error('Error obteniendo institución del estudiante:', err1);
      return res.status(500).json({ error: 'Error interno al obtener institución' });
    }
    if (rows1.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    const idInstitucionEducativa = rows1[0].idInstitucionEducativa;

    // 2) Insertamos la familia incluyendo idEstudiante y validamos institución
    const sql = `
      INSERT INTO familia_estudiante
        (idEstudiante, NombreMadreApoderado, DNI, Direccion, Telefono, Ocupacion, idInstitucionEducativa)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(sql, [
      idEstudiante,
      NombreMadreApoderado,
      DNI,
      Direccion || null,
      Telefono || null,
      Ocupacion || null,
      idInstitucionEducativa
    ], (err2, result) => {
      if (err2) {
        console.error('Error al registrar familia:', err2);
        return res.status(500).json({ error: 'Error interno al registrar familia' });
      }
      res.status(201).json({ idFamilia: result.insertId });
    });
  });
});


// --- Actualizar datos de una familia (y re-validar IE) ---
app.put('/actualizar-familia', (req, res) => {
  const { idFamilia, idEstudiante, NombreMadreApoderado, DNI, Direccion, Telefono, Ocupacion } = req.body;
  if (!idFamilia || !idEstudiante || !NombreMadreApoderado || !DNI) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  // Comprobamos que el estudiante siga perteneciendo a la misma IE
  const sqlInst = `
    SELECT idInstitucionEducativa
    FROM estudiantes
    WHERE idEstudiante = ?
  `;
  db.query(sqlInst, [idEstudiante], (err1, rows1) => {
    if (err1) {
      console.error('Error obteniendo institución del estudiante:', err1);
      return res.status(500).json({ error: 'Error interno al obtener institución' });
    }
    if (rows1.length === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    const idInstitucionEducativa = rows1[0].idInstitucionEducativa;

    // Ahora actualizamos
    const sql = `
      UPDATE familia_estudiante
      SET
        idEstudiante         = ?,
        NombreMadreApoderado = ?,
        DNI                  = ?,
        Direccion            = ?,
        Telefono             = ?,
        Ocupacion            = ?,
        idInstitucionEducativa = ?
      WHERE idFamilia = ?
    `;
    const params = [
      idEstudiante,
      NombreMadreApoderado,
      DNI,
      Direccion || null,
      Telefono || null,
      Ocupacion || null,
      idInstitucionEducativa,
      idFamilia
    ];
    db.query(sql, params, (err2) => {
      if (err2) {
        console.error('Error al actualizar familia:', err2);
        return res.status(500).json({ error: 'Error interno al actualizar familia' });
      }
      res.status(200).json({ message: 'Familia actualizada con éxito' });
    });
  });
});


// Buscar familia por NombreMadreApoderado
// --- Estudiantes con familia (agrega filtro IE) ---
app.get('/estudiantes-con-familia', (req, res) => {
  const { idInstitucionEducativa } = req.query;
  let sql = 'SELECT DISTINCT idEstudiante FROM familia_estudiante';
  const params = [];
  if (idInstitucionEducativa) {
    sql += ' WHERE idInstitucionEducativa = ?';
    params.push(idInstitucionEducativa);
  }
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: 'Error interno' });
    res.json(results.map(r => r.idEstudiante));
  });
});

// --- Listar familias por IE y nombreMadreApoderado opcional ---
app.get('/familias-estudiante', (req, res) => {
  const { idInstitucionEducativa, nombreMadreApoderado } = req.query;
  let sql = `
    SELECT
      fe.idFamilia,
      fe.idEstudiante,
      e.ApellidosNombres AS NombreEstudiante,
      fe.NombreMadreApoderado,
      fe.DNI,
      fe.Direccion,
      fe.Telefono,
      fe.Ocupacion
    FROM familia_estudiante fe
    JOIN estudiantes e ON fe.idEstudiante = e.idEstudiante
  `;
  const where = [];
  const params = [];

  if (idInstitucionEducativa) {
    where.push('fe.idInstitucionEducativa = ?');
    params.push(idInstitucionEducativa);
  }
  if (nombreMadreApoderado) {
    where.push('fe.NombreMadreApoderado LIKE ?');
    params.push(`%${nombreMadreApoderado}%`);
  }
  if (where.length) {
    sql += ' WHERE ' + where.join(' AND ');
  }
  sql += ' ORDER BY fe.idFamilia ASC';

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error al obtener familias:', err);
      return res.status(500).json({ error: 'Error interno al obtener familias' });
    }
    res.json(results);
  });
});

// server.js

app.get('/buscar-familia', (req, res) => {
  const { nombreMadreApoderado, idInstitucionEducativa } = req.query;
  if (!nombreMadreApoderado || !idInstitucionEducativa) {
    return res.status(400).send('Falta nombreMadreApoderado o idInstitucionEducativa');
  }
  const sql = `
    SELECT
      fe.idFamilia,
      fe.idEstudiante,
      e.ApellidosNombres AS NombreEstudiante,
      fe.NombreMadreApoderado,
      fe.DNI,
      fe.Direccion,
      fe.Telefono,
      fe.Ocupacion
    FROM familia_estudiante fe
    JOIN estudiantes e ON fe.idEstudiante = e.idEstudiante
    WHERE fe.NombreMadreApoderado = ?
      AND fe.idInstitucionEducativa = ?
    LIMIT 1
  `;
  db.query(sql, [nombreMadreApoderado, idInstitucionEducativa], (err, results) => {
    if (err) {
      console.error('Error al buscar familia:', err);
      return res.status(500).json({ error: 'Error interno al buscar familia' });
    }
    if (results.length === 0) {
      return res.status(404).send('Familia no encontrada');
    }
    res.json(results[0]);
  });
});


app.get('/estudiantes-con-familia', (req, res) => {
  const sql = `SELECT DISTINCT idEstudiante FROM familia_estudiante`;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error al obtener estudiantes con familia:', err);
      return res.status(500).json({ error: 'Error interno' });
    }
    // results: [ { idEstudiante: 1 }, { idEstudiante: 5 }, … ]
    res.json(results.map(r => r.idEstudiante));
  });
});



// GET /estudiante/:id
app.get('/estudiante/:id', (req, res) => {
  const id = req.params.id;
  const sql = `
    SELECT
      idEstudiante,
      ApellidosNombres,
      DATE_FORMAT(FechaNacimiento, '%d/%m/%Y') AS FechaNacimiento,
      Edad,
      DNI,
      GradoSeccion,
      TipoDiscapacidad,
      DocumentoSustentatorio,
      DocumentoInclusiva,
      IPP,
      PEP
    FROM estudiantes
    WHERE idEstudiante = ?
  `;
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Error interno' });
    if (results.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(results[0]);
  });
});







// Transporter de nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS
  }
});

const ALLOWED_EMAILS = [
  process.env.GMAIL_USER,
  'gezetab@ucvvirtual.edu.pe',
  'gerson29012004@gmail.com'
];


// Solicitar envío de token
app.post('/solicitar-reset', (req, res) => {
  const { correo } = req.body;
  if (!correo || !ALLOWED_EMAILS.includes(correo.trim())) {
    return res.status(401).json({ ok:false, mensaje:'Correo no autorizado' });
  }
  const token = Math.floor(100000 + Math.random()*900000).toString();
  db.query(
    `UPDATE administrador
       SET reset_token=?, token_expiracion=DATE_ADD(NOW(), INTERVAL 15 MINUTE)
     WHERE correo=?`,
    [token, correo.trim()],
    (err, result) => {
      if (err||!result.affectedRows) {
        return res.status(500).json({ ok:false, mensaje:'No se pudo generar token' });
      }
      transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: correo,
        subject: 'Tu código de seguridad',
        text: `Tu código de seguridad es: ${token}`
      }, mailErr => {
        if (mailErr) return res.status(500).json({ ok:false, mensaje:'Error enviando email' });
        return res.json({ ok:true, mensaje:'Token enviado' });
      });
    }
  );
});


// Confirmar cambio de clave
app.post('/reset-security-code', (req, res) => {
  const { correo, token, nuevaClave } = req.body;
  if (!correo||!token||!nuevaClave) {
    return res.status(400).json({ ok:false, mensaje:'Faltan datos' });
  }
  db.query(
    `SELECT reset_token, token_expiracion
       FROM administrador WHERE correo=?`,
    [correo.trim()],
    (err, rows) => {
      if (err||!rows.length) {
        return res.status(400).json({ ok:false, mensaje:'Correo inválido' });
      }
      const { reset_token, token_expiracion } = rows[0];
      if (reset_token!==token.trim()||new Date(token_expiracion)<new Date()) {
        return res.status(400).json({ ok:false, mensaje:'Token inválido o expirado' });
      }
      db.query(
        `UPDATE administrador
           SET clave=?, reset_token=NULL, token_expiracion=NULL
         WHERE correo=?`,
        [nuevaClave, correo.trim()],
        updErr => updErr
          ? res.status(500).json({ ok:false, mensaje:'Error al cambiar clave' })
          : res.json({ ok:true, mensaje:'Clave cambiada con éxito' })
      );
    }
  );
});

app.get('/existe-admin', (req, res) => {
  db.query('SELECT COUNT(*) AS total FROM administrador', (err, results) => {
    if (err) return res.status(500).json({ error: 'Error servidor' });
    res.json({ existe: results[0].total > 0 });
  });
});

// Registrar administrador
app.post('/registrar-admin', (req, res) => {
  const { correo, clave } = req.body;
  if (!correo || !clave) return res.status(400).json({ ok:false, mensaje:'Faltan campos' });
  db.query(
    'INSERT INTO administrador (correo, clave) VALUES (?, ?)',
    [correo.trim(), clave],
    err => err
      ? res.status(500).json({ ok:false, mensaje:'Error al registrar' })
      : res.json({ ok:true })
  );
});

app.post('/login-admin', (req, res) => {
  const { correo, clave } = req.body;
  db.query(
    'SELECT clave FROM administrador WHERE correo = ?',
    [correo.trim()],
    (err, rows) => {
      if (err) return res.status(500).json({ ok:false, mensaje:'Error servidor' });
      if (!rows.length) return res.json({ ok:false, mensaje:'Correo no registrado' });
      return rows[0].clave === clave
        ? res.json({ ok:true })
        : res.json({ ok:false, mensaje:'Clave incorrecta' });
    }
  );
});

// En server.js, justo antes de app.listen(...):

// 1) Estadísticas de discapacidad
app.get('/estadisticas/discapacidad', (req, res) => {
  const sql = `
    SELECT
      COALESCE(TipoDiscapacidad, 'Sin especificar') AS label,
      COUNT(*) AS value
    FROM estudiantes
    GROUP BY TipoDiscapacidad
    ORDER BY value DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Error interno' });
    res.json(results);
  });
});

// 2) Estadísticas IPP vs PEP
app.get('/estadisticas/ipp-pep', (req, res) => {
  const sql = `
    SELECT
      SUM(IPP = 'Si')   AS ippSi,
      SUM(IPP = 'No')   AS ippNo,
      SUM(PEP = 'Si')   AS pepSi,
      SUM(PEP = 'No')   AS pepNo
    FROM estudiantes
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Error interno' });
    res.json(results[0]);
  });
});

// 3) Alumnos por institución
app.get('/estadisticas/instituciones', (req, res) => {
  const sql = `
    SELECT
      ie.NombreInstitucion AS label,
      COUNT(e.idEstudiante) AS value
    FROM instituciones_educativas ie
    LEFT JOIN estudiantes e
      ON ie.idInstitucionEducativa = e.idInstitucionEducativa
    GROUP BY ie.idInstitucionEducativa
    ORDER BY value DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Error interno' });
    res.json(results);
  });
});

// 4) Familias por ocupación
app.get('/estadisticas/ocupacion-familia', (req, res) => {
  const sql = `
    SELECT
      COALESCE(Ocupacion, 'No especificado') AS label,
      COUNT(*) AS value
    FROM familia_estudiante
    GROUP BY Ocupacion
    ORDER BY value DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Error interno' });
    res.json(results);
  });
});


app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
