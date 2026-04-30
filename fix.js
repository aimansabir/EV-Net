const fs = require('fs');
const path = 'c:/Users/AM Business/.gemini/antigravity/ChargeBnB/src/layouts/AdminLayout.jsx';
let content = fs.readFileSync(path, 'utf8');

const target = <Link to=" /\ style={{ \r\n display: 'flex', alignItems: 'center', gap: '8px',\r\n fontSize: '0.85rem', color: 'var(--text-secondary)', \r\n textDecoration: 'none', transition: 'color 0.2s' \r\n }}\r\n onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}\r\n onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}\r\n >\r\n <ArrowLeft size={14} />\r\n <span>Back to Site</span>\r\n </Link>;
const target2 = <Link to=\/\ style={{ \n display: 'flex', alignItems: 'center', gap: '8px',\n fontSize: '0.85rem', color: 'var(--text-secondary)', \n textDecoration: 'none', transition: 'color 0.2s' \n }}\n onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}\n onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}\n >\n <ArrowLeft size={14} />\n <span>Back to Site</span>\n </Link>;

const replacement = <button onClick={() => signOut()} style={{ \n display: 'flex', alignItems: 'center', gap: '8px',\n fontSize: '0.85rem', color: 'var(--text-secondary)', \n background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.2s', fontFamily: 'inherit' \n }}\n onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}\n onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}\n >\n <LogOut size={14} />\n <span>Logout</span>\n </button>;

if (content.includes(target)) {
 content = content.replace(target, replacement);
} else if (content.includes(target2)) {
 content = content.replace(target2, replacement);
} else {
 // regex fallback
 content = content.replace(/<Link to=\\/\[^>]*>[\s\S]*?<ArrowLeft[^>]*>[\s\S]*?<span>Back to Site<\/span>[\s\S]*?<\/Link>/, replacement);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Done');
