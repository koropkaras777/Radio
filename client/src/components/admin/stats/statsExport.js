import * as XLSX from 'xlsx';
import { formatDur } from './statsHelpers.js';

const pad2 = (n) => String(n).padStart(2, '0');

export const buildExportFilename = (ext) => {
  const d = new Date();
  return `${pad2(d.getDate())}${pad2(d.getMonth() + 1)}${d.getFullYear()}${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}.${ext}`;
};

export const collectExportSongs = (statsData, folders) => {
  const songs = [];
  folders.forEach((folder) => {
    const artists = statsData?.[folder] || {};
    Object.entries(artists).forEach(([artist, list]) => {
      list.forEach((song) => songs.push({ ...song, artist, folder }));
    });
  });
  return songs;
};

export const buildTxtExport = (songs, fields, showMode) => {
  const lines = songs.map((song) => {
    let line = `${song.artist} - ${song.title}`;
    const hasAlbum = fields.album && song.album;
    const hasYear  = fields.year && song.year;
    if (hasAlbum && hasYear)   line += ` · ${song.album} (${song.year})`;
    else if (hasAlbum)        line += ` · ${song.album}`;
    else if (hasYear)         line += ` (${song.year})`;
    if (fields.duration)      line += ` - ${formatDur(song.duration)}`;
    if (showMode)              line += ` |${song.folder === 'night' ? 'night' : 'day'}|`;
    return line;
  });
  lines.push('');
  lines.push(`${songs.length} songs]`);
  lines.push(`Exported at ${Date.now()}`);
  return lines.join('\n');
};

export const buildJsonExport = (songs, fields, showMode) => {
  const data = {
    exportedAt: Date.now(),
    count: songs.length,
    songs: songs.map((song) => {
      const item = { artist: song.artist, title: song.title };
      if (fields.album)    item.album    = song.album    || null;
      if (fields.year)     item.year     = song.year     || null;
      if (fields.duration) item.duration = song.duration || null;
      if (showMode)         item.mode     = song.folder;
      return item;
    }),
  };
  return JSON.stringify(data, null, 2);
};

const csvEscape = (val) => {
  const s = String(val ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const buildCsvExport = (songs, fields, showMode) => {
  const headers = ['Artist', 'Title'];
  if (fields.album)    headers.push('Album');
  if (fields.year)     headers.push('Year');
  if (fields.duration) headers.push('Duration');
  if (showMode)          headers.push('Mode');

  const rows = songs.map((song) => {
    const row = [song.artist, song.title];
    if (fields.album)    row.push(song.album || '');
    if (fields.year)     row.push(song.year || '');
    if (fields.duration) row.push(formatDur(song.duration));
    if (showMode)          row.push(song.folder === 'night' ? 'night' : 'day');
    return row.map(csvEscape).join(',');
  });

  return ['sep=,', headers.join(','), ...rows].join('\r\n');
};

export const downloadTextFile = (filename, content, mime, withBom = false) => {
  const parts = withBom ? ['\ufeff', content] : [content];
  const blob  = new Blob(parts, { type: `${mime};charset=utf-8` });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href      = url;
  a.download  = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadXlsxExport = (filename, songs, fields, showMode) => {
  const headers = ['Artist', 'Title'];
  if (fields.album)    headers.push('Album');
  if (fields.year)     headers.push('Year');
  if (fields.duration) headers.push('Duration');
  if (showMode)          headers.push('Mode');

  const rows = songs.map((song) => {
    const row = [song.artist, song.title];
    if (fields.album)    row.push(song.album || '');
    if (fields.year)     row.push(song.year || '');
    if (fields.duration) row.push(formatDur(song.duration));
    if (showMode)          row.push(song.folder === 'night' ? 'night' : 'day');
    return row;
  });

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = headers.map((header, colIndex) => {
    const maxLen = wsData.reduce((max, row) => {
      const cell = row[colIndex] == null ? '' : String(row[colIndex]);
      return Math.max(max, cell.length);
    }, header.length);
    return { wch: Math.min(Math.max(maxLen + 2, 8), 60) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  XLSX.writeFile(wb, filename);
};