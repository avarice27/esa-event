const bcrypt = require('bcryptjs');
const db = require('./config/database');

async function fixPassword() {
  try {
    // Generate hash for "admin123"
    const password = 'admin123';
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    console.log('Generated hash for "admin123":', hashedPassword);
    
    // Update all users with the new password hash
    const result = await db.query(
      'UPDATE users SET password_hash = $1 WHERE username IN ($2, $3, $4)',
      [hashedPassword, 'admin', 'manager', 'user']
    );
    
    console.log('Updated', result.rowCount, 'users');
    
    // Verify the update
    const users = await db.query('SELECT username, password_hash FROM users');
    console.log('Current users:');
    users.rows.forEach(user => {
      console.log(`- ${user.username}: ${user.password_hash.substring(0, 20)}...`);
    });
    
    console.log('\nPassword updated successfully!');
    console.log('You can now login with:');
    console.log('Username: admin, Password: admin123');
    console.log('Username: manager, Password: admin123');
    console.log('Username: user, Password: admin123');
    
    process.exit(0);
  } catch (error) {
    console.error('Error fixing password:', error);
    process.exit(1);
  }
}

fixPassword();