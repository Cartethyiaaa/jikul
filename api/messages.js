import { getDb, memoryStore } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    try {
      const db = await getDb();
      if (db) {
        const rows = await db`
          SELECT id, name, role, tag, content,
                 COALESCE(time_str, to_char(created_at, 'DD Mon YYYY, HH24:MI')) as time,
                 created_at
          FROM messages
          ORDER BY id DESC
          LIMIT 100;
        `;
        return res.status(200).json({ success: true, messages: rows });
      }

      return res.status(200).json({ success: true, messages: memoryStore.messages, source: 'fallback' });
    } catch (err) {
      console.error('Fetch messages error:', err);
      return res.status(200).json({ success: true, messages: memoryStore.messages, source: 'fallback' });
    }
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) {}
      }

      const { name, role, tag, content } = body || {};
      if (!name || !content) {
        return res.status(400).json({ success: false, message: 'Nama dan isi pesan wajib diisi.' });
      }

      const now = new Date();
      const timeStr = now.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) + ', ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

      const cleanName = String(name).trim().slice(0, 100);
      const cleanRole = String(role || 'Member Circle').trim().slice(0, 100);
      const cleanTag = String(tag || 'Ramen & Jajan').trim().slice(0, 50);
      const cleanContent = String(content).trim().slice(0, 2000);

      const db = await getDb();
      if (db) {
        const result = await db`
          INSERT INTO messages (name, role, tag, content, time_str)
          VALUES (${cleanName}, ${cleanRole}, ${cleanTag}, ${cleanContent}, ${timeStr})
          RETURNING id, name, role, tag, content, time_str as time, created_at;
        `;
        return res.status(201).json({ success: true, message: result[0] });
      }

      const newMsg = {
        id: Date.now(),
        name: cleanName,
        role: cleanRole,
        tag: cleanTag,
        content: cleanContent,
        time: timeStr
      };
      memoryStore.messages.unshift(newMsg);
      return res.status(201).json({ success: true, message: newMsg, source: 'fallback' });
    } catch (err) {
      console.error('Create message error:', err);
      return res.status(500).json({ success: false, message: 'Gagal menyimpan pesan ke database.' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
