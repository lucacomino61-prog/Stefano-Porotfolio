import { hashPassword } from '../lib/auth'

const password = process.argv[2]

if (!password) {
  console.error('Usage: npm run hash-password -- "your password"')
  process.exit(1)
}

hashPassword(password).then((hash) => {
  console.log('\nAdd this line to .env.local:\n')
  console.log(`ADMIN_PASSWORD_HASH=${hash}\n`)
})
