const fs = require('fs');
const path = require('path');
const { getClient } = require('./db');

async function executeSchema() {
    const client = getClient();
    
    try {
        console.log('🔌 Conectando ao Supabase...');
        await client.connect();
        console.log('✅ Conectado!');
        
        console.log('📖 Lendo schema.sql...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Executar schema inteiro de uma vez (node-pg suporta multi-statements;
        // split por ';' quebra funcoes plpgsql com $$)
        console.log('🚀 Executando schema completo...');
        try {
            await client.query(schema);
        } catch (err) {
            console.error('⚠️ Erro no schema (pode ser parcial/idempotente):', err.message);
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