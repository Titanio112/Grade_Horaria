$c = Get-Content 'D:\aphmgbr\Documents\VS-CODE\Grade hor ria\index.html' -Raw; if (\$c -match 'dados.js') { 'FOUND' } else { 'NOT FOUND' }  
