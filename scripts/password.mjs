import {pbkdf2Sync,randomBytes} from 'node:crypto';
import readline from 'node:readline';
if(!process.stdin.isTTY)throw new Error('Run this in an interactive terminal.');
process.stdout.write('Нова парола (минимум 14 знака, скрито въвеждане): ');
process.stdin.setRawMode(true);process.stdin.resume();let input='';
process.stdin.on('data',buf=>{for(const c of buf.toString()){if(c==='\u0003'){process.stdin.setRawMode(false);process.exit(1);}if(c==='\r'||c==='\n'){process.stdin.setRawMode(false);process.stdin.pause();if(input.length<14){console.error('\nПаролата е твърде кратка.');process.exit(1);}const salt=randomBytes(16);console.log('\nOWNER_PASSWORD_HASH=pbkdf2$100000$'+salt.toString('base64')+'$'+pbkdf2Sync(input,salt,100000,32,'sha256').toString('hex'));process.exit(0);}if(c==='\u007f')input=input.slice(0,-1);else input+=c;}});
