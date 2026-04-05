import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres.pdkkznkwybvilkpmxqmx:Dhanush@2404@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

async function deleteUser() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        
        console.log("Checking if user exists one last time...");
        const checkRes = await client.query("SELECT id, name, email FROM public.users WHERE email = $1", ['kanimozhi200724@gmail.com']);
        
        if (checkRes.rows.length === 0) {
            console.log("User 'kanimozhi200724@gmail.com' not found. They might have already been deleted.");
            return;
        }

        const user = checkRes.rows[0];
        console.log(`Found User: ${user.name} (${user.email}) - ID: ${user.id}`);

        // We delete from auth.users, and public.users will cascade
        console.log("Deleting user from auth.users (cascades to public.users)...");
        const deleteRes = await client.query("DELETE FROM auth.users WHERE email = $1", ['kanimozhi200724@gmail.com']);
        
        if (deleteRes.rowCount > 0) {
            console.log(`Successfully deleted ${deleteRes.rowCount} user(s) matching 'kanimozhi200724@gmail.com'.`);
        } else {
            // Fallback: Sometimes users are only in public.users if auth is separate or if there was an issue
            console.log("User not found in auth.users. Trying deletion from public.users directly...");
            const deletePublicRes = await client.query("DELETE FROM public.users WHERE email = $1", ['kanimozhi200724@gmail.com']);
            console.log(`Deleted ${deletePublicRes.rowCount} user(s) from public.users.`);
        }

    } catch (err) {
        console.error("Error during deletion:", err);
    } finally {
        await client.end();
    }
}

deleteUser();
