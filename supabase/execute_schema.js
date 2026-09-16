const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres.zhcubvmismnmvtrbolbu:***REMOVED_DB_PASSWORD***@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

async function executeSchema() {
    const client = new Client({ connectionString });
    
    try {
        console.log('🔌 Conectando ao Supabase...');
        await client.connect();
        console.log('✅ Conectado!');
        
        console.log('📖 Lendo schema.sql...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Dividir em statements individuais
        const statements = schema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        
        console.log(`🚀 Executando ${statements.length} statements...`);
        
        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i] + ';';
            try {
                await client.query(stmt);
                if (i % 10 === 0) console.log(`  ${i}/${statements.length}...`);
            } catch (err) {
                if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
                    console.error(`⚠️ Statement ${i} falhou:`, err.message);
                    console.error('Statement:', stmt.substring(0, 100) + '...');
                }
            }
        }
        
        console.log('✅ Schema executado!');
        
        // Verificar tabelas
        const tables = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' ORDER BY table_name
        `);
        console.log('\n📋 Tabelas:', tables.rows.map(t => t.table_name).join(', '));
        
        // Verificar funções
        const functions = await client.query(`
            SELECT routine_name FROM information_schema.routines 
            WHERE routine_schema = 'public' ORDER BY routine_name
        `);
        console.log('⚙️ Funções:', functions.rows.map(f => f.routine_name).join(', '));
        
        // Verificar policies
        const policies = await client.query(`
            SELECT tablename, policyname FROM pg_policies 
            WHERE schemaname = 'public' ORDER BY tablename, policyname
        `);
        console.log('🔒 Policies:', policies.rows.length);
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await client.end();
    }
}

executeSchema();