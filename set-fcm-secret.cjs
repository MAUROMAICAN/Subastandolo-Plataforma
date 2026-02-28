const { execSync } = require('child_process');
const fs = require('fs');

try {
    const jsonContent = fs.readFileSync('subastandolo-app-763640a35bd6.json', 'utf8');
    // Create a temporary .env file to bypass shell escaping issues
    // The value doesn't need quotes if we use it directly as key=value format in a simple way,
    // but to be safe with multiline JSON, we wrap it in single quotes.
    fs.writeFileSync('fcm-secret-temp.env', `FCM_SERVICE_ACCOUNT='${jsonContent}'\n`);

    console.log('Setting Supabase secrets from temp environment file...');
    execSync('npx supabase secrets set --env-file fcm-secret-temp.env', { stdio: 'inherit' });

    console.log('Secrets set successfully.');
} catch (error) {
    console.error('Failed to set secrets:', error);
} finally {
    if (fs.existsSync('fcm-secret-temp.env')) {
        fs.unlinkSync('fcm-secret-temp.env');
    }
}
