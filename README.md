# Saathi Backend

Ye backend teen kaam karta hai:
1. Har user ke free messages (10) track karta hai
2. Limit khatam hone par Razorpay se payment leta hai
3. Anthropic API ko safely call karta hai (API key sirf yahan, frontend me kabhi nahi)

## Setup

1. Is folder me terminal khol kar likho:
   ```
   npm install
   ```

2. `.env.example` ko copy karke `.env` naam se save karo, aur usme apni asli keys daalo:
   - `ANTHROPIC_API_KEY` — console.anthropic.com se
   - `RAZORPAY_KEY_ID` aur `RAZORPAY_KEY_SECRET` — dashboard.razorpay.com se (Settings > API Keys)

3. Server chalane ke liye:
   ```
   npm start
   ```
   Ye `http://localhost:3000` par chalega.

## Deploy karna (free hosting)

- **Render.com** ya **Railway.app** par jao, GitHub repo connect karo (ya folder upload karo)
- Environment variables wahi teen keys add karo jo `.env` me hain
- Deploy hote hi aapko ek live URL milega (jaise `https://saathi-backend.onrender.com`)
- Us URL ko apni website ke JavaScript me `BACKEND_URL` variable me daal dena

## Database ke baare me

Abhi ye `db.json` naam ki simple file me data save karta hai — testing aur chhoti scale ke liye theek hai.
Zyada users aane par isse Postgres, MongoDB Atlas, ya Supabase jaisi asli database me badalna better hoga
(khaas taur par Render jaise free hosting par disk reset ho sakta hai, isliye data permanently store nahi rahega).

## Test mode vs Live mode (Razorpay)

Razorpay pehle "Test mode" me milta hai — test cards se payment simulate kar sakte ho, asli paisa nahi katega.
Jab sab sahi se kaam kare, KYC complete karke "Live mode" activate karo — tabhi asli payments aa payenge.
