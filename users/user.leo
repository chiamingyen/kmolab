<?xml version="1.0" encoding="utf-8"?>
<!-- Created by Leo: http://leoeditor.com/leo_toc.html -->
<?xml-stylesheet ekr_test ?>
<leo_file xmlns:leo="http://leoeditor.com/namespaces/leo-python-editor/1.1" >
<leo_header file_format="2" tnodes="0" max_tnode_index="0" clone_windows="0"/>
<globals body_outline_ratio="0.5" body_secondary_ratio="0.5">
	<global_window_position top="50" left="50" height="500" width="700"/>
	<global_log_window_position top="0" left="0" height="0" width="0"/>
</globals>
<preferences/>
<find_panel_settings/>
<vnodes>
<v t="leo.20151212173315.1"><vh>@settings</vh>
<v t="leo.20151212173315.2"><vh>@data qt-gui-plugin-style-sheet</vh></v>
<v t="leo.20151212173315.3"><vh>@string initial_split_orientation = horizontal</vh></v>
</v>
<v t="amd.20160106095324.1" a="E"><vh>@path ./../</vh>
<v t="leo.20151213173811.1" a="E"><vh>假如要送到 gh-pages 分支, 使用下列按鈕</vh>
<v t="leo.20151212173658.1"><vh>@button gh-pages pelican</vh></v>
</v>
<v t="leo.20151213173830.1" a="E"><vh>假如要在近端檢視, 使用下列按鈕</vh>
<v t="leo.20151213085727.1"><vh>@button local pelican</vh></v>
</v>
</v>
<v t="amd.20151215170350.1"><vh>以下為 content 目錄中的 md 檔案</vh></v>
<v t="amd.20160106093610.1"><vh>協同網誌編寫規範</vh></v>
<v t="amd.20151216001126.1"><vh>md 檔案範例</vh></v>
<v t="amd.20151215170031.1" a="E"><vh>@path ./../content</vh>
<v t="amd.20160106093454.1" a="E"><vh>user 網誌文章</vh>
<v t="amd.20160106093510.1" a="E"><vh>201601</vh>
<v t="amd.20160106093531.1" a="E"><vh>w1 - 文章務必要冠上用戶名稱</vh>
<v t="amd.20160106093542.1"><vh>@edit user_20160106.md</vh></v>
</v>
</v>
</v>
</v>
</vnodes>
<tnodes>
<t tx="amd.20151215170031.1"></t>
<t tx="amd.20151215170350.1"></t>
<t tx="amd.20151216001126.1">@language md
Title: 文章標題
Category: 類別
Tags: 標籤
Author: kmol

這裡放入文章摘要

&lt;!-- PELICAN_END_SUMMARY --&gt;

這裡為文章主要內容</t>
<t tx="amd.20160106093454.1"></t>
<t tx="amd.20160106093510.1"></t>
<t tx="amd.20160106093531.1"></t>
<t tx="amd.20160106093610.1">協同成員的 .leo 檔案

    每一位協同者, 各自可以在 users 目錄下擁有一個 .leo 檔案, 用來維護各自位於 content 目錄下的 .md 檔案,
    
    例如: user yen 的 .leo 檔案位於 users/yen.leo

協同成員的 .md 檔案命名

    由於各成員所編寫的 .md 檔案都位於 content 目錄下, 因此必須在各負責的 .md 檔案名稱冠上用戶名稱,
    
    例如: 由 yen 負責編寫的 .md 檔案, 特別命名為 yen_20160106.md, 若一天有兩篇以上文章, 則取 yen_20160106-1.md
    
    當使用者要利用 pelican 在近端轉換網誌時, 必須使用 local-pelican 按鈕, 若要送到 github pages 網站, 則必須透過 gh-pages-pelican 按鈕轉檔.

pages 文章

    寫在 content/pages 目錄中的 .md 檔案, 將會被轉為網誌 pages 內容

</t>
<t tx="amd.20160106095324.1"></t>
<t tx="leo.20151212173315.1"></t>
<t tx="leo.20151212173315.2">QTreeWidget {
    /* These apply to the selected item, but not to editing items.*/
    background-color: #ffffec; /* Leo's traditional tree color */
    selection-color: black; /* was white */
    selection-background-color: lightgrey;
    /* font-family: SansSerif; */
    /*font-family: DejaVu Sans Mono;*/
    font-family:YaHei Mono;
    /* 標題字型大小設定 */
    font-size: 20px;
    font-weight: normal; /* normal,bold,100,..,900 */
    font-style: normal; /* normal, italic,oblique */
 }

/* Headline edit widgets */
QTreeWidget QLineEdit {
    background-color: cornsilk;
    selection-color: white;
    selection-background-color: blue;
    /*font-family: DejaVu Sans Mono;*/    
    font-family:YaHei Mono;
    /* 沒有特別對應字型大小 */
    font-size: 20px;
    font-weight: normal; /* normal,bold,100,..,900 */
    font-style: normal; /* normal, italic,oblique */
}

/* The log panes */
QTextEdit {
    background-color: #f2fdff;
    selection-color: red;
    selection-background-color: blue;
    /* font-family: Courier New; */
    font-family:YaHei Mono;
    /* log font 大小 */
    font-size: 20px;
    font-weight: normal; /* normal,bold,100,..,900 */
    font-style: normal; /* normal, italic,oblique */
}

/* The body pane */
QTextEdit#richTextEdit {
    background-color: #fdf5f5; /* A kind of pink. */
    selection-color: white;
    selection-background-color: red;
    /*font-family: DejaVu Sans Mono;*/
    /* font-family: Courier New; */
    font-family:YaHei Mono;
    /* 內文字型大小 */
    font-size: 20px;
    font-weight: normal; /* normal,bold,100,..,900 */
    font-style: normal; /* normal,italic,oblique */
}

QLabel {
    font-family:YaHei Mono;'CherryPy', 'pytz', 'mako', 'beautifulsoup4', 'pymysql', 'peewee'
    /* 下方的 Minibuffer 標題字型大小 */
    font-size: 20px;
    font-weight: normal; /* normal,bold,100,..,900 */
    font-style: normal; /* normal,italic,oblique */
}

/* Editor labels */
QLineEdit#editorLabel {
    background-color: #ffffec;
    font-family:YaHei Mono;
    /* 沒有直接對應字型大小 */
    font-size: 20px;
    font-weight: normal; /* normal,bold,100,..,900 */
    font-style: normal; /* normal,italic,oblique */
    border: 2px;
    margin: 2px;
}</t>
<t tx="leo.20151212173315.3">horizontal: body pane to the left
vertical: body pane on the botton</t>
<t tx="leo.20151212173658.1">@language python
import os
#os.system("pelican content -o ./ -s publishconf.py -t theme/pelican-bootstrap3")
os.system("pelican content -o blog -s publishconf.py")
g.es("admin pelican 執行完畢")

</t>
<t tx="leo.20151213085727.1">@language python
import os
#os.system("pelican content -o output -s local_publishconf.py -t theme/pelican-bootstrap3")
os.system("pelican content -o blog -s local_publishconf.py")
g.es("admin pelican 近端執行完畢")


</t>
<t tx="leo.20151213173811.1"></t>
<t tx="leo.20151213173830.1"></t>
</tnodes>
</leo_file>
