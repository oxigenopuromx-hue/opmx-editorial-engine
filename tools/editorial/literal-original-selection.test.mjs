import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolveApprovedLiteralOriginal,selectedLiteralLayout,literalComparisonDiagnostic} from './literal-original-selection.mjs';
import {buildLiteralDelivery} from './literal-delivery-v3.mjs';
import {extractLiteralPlainText,normalizeLiteralText,assertLiteralCanonicalText} from './literal-text-v3.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const pkg='tg_'+'a'.repeat(40),source='ti_'+'1'.repeat(40),instruction='ti_'+'2'.repeat(40),image='ti_'+'3'.repeat(40),word='ti_'+'4'.repeat(40);
const text='Título del informe\nlegislativo completo\n• Primera propuesta íntegra.\nZapopan, Jalisco. Este es el cuerpo íntegro.\nUsa exclusivamente esta frase es también parte del comunicado.';
const note='Usa sólo el texto pegado; no publiques esta instrucción.';
const approval={packageId:pkg,baseRevision:19,itemId:source,sha256:hash(text),instructionItemId:instruction,instructionSha256:hash(note),imageItemId:image,imageSha256:hash('imagen'),discardedItemId:word,discardedSha256:hash('Word con BOLETÍN DE PRENSA'),titleLineCount:2,approvalReference:'SYNTHETIC_TEST'};
const scope=()=>({packageId:pkg,baseRevision:19,revision:21,action:'CREATE',mode:'LITERAL',destination:'AMBOS',controlItemIds:[],items:[{itemId:source,kind:'TEXT',state:'STORED',text,sha256:hash(text)},{itemId:instruction,kind:'TEXT',state:'STORED',text:note,sha256:hash(note)},{itemId:image,kind:'FILE',state:'STORED',sha256:hash('imagen')},{itemId:word,kind:'FILE',state:'DISCARDED',sha256:approval.discardedSha256}]});
const policy={authorized:true,mode:'PUBLISH',content_mode:'LITERAL',destination:'AMBOS',destinations:['OPURO','OPOL'],policy:'publish-ambos-v4'};

test('selected original compiles through the real existing literal renderer',()=>{
 const selection=resolveApprovedLiteralOriginal(scope(),[approval]),layout=selectedLiteralLayout(text,selection.titleLineCount);
 const {master,requestId}=buildLiteralDelivery({baseMaster:{CONTROL_EDITORIAL:{ESTADO:'LISTO'},SEO:{}},policy,packageId:pkg,revision:21,...layout});
 assert.equal(master.SEO.TITULO_SEO,'Título del informe legislativo completo');assert.equal(master.SEO.SUBTITULO,'');assert.equal(master.TEXTO_EDITORIAL.PARRAFOS.length,3);
 assert.equal(normalizeLiteralText(master.SEO.TITULO_SEO+' '+extractLiteralPlainText(master.GUTENBERG_FINAL)),normalizeLiteralText(text));
 assert.ok(master.GUTENBERG_FINAL.includes('Usa exclusivamente esta frase'));assert.ok(!master.GUTENBERG_FINAL.includes(note));assert.ok(!master.GUTENBERG_FINAL.includes('BOLETÍN DE PRENSA'));
 assert.equal(requestId,'tg_'+hash(pkg+':21:AMBOS:draft-v1'));
});
test('legacy rejection of a wrapped title is reproducible while the approved layout passes',()=>{
 const layout=selectedLiteralLayout(text,2),{master}=buildLiteralDelivery({baseMaster:{CONTROL_EDITORIAL:{ESTADO:'LISTO'},SEO:{}},policy,packageId:pkg,revision:21,...layout});
 const p={title:layout.title,subtitle:'',html:master.HTML_FINAL,gutenberg:master.GUTENBERG_FINAL,enriched:master.GUTENBERG_ENRIQUECIDO_FINAL};
 assert.throws(()=>assertLiteralCanonicalText({sourceText:text,...p}),/LITERAL_TEXT_UNCONFIRMED/);assertLiteralCanonicalText({sourceText:layout.sourceText,...p});
});
test('active Word, changed original, changed image and ambiguous extra text are rejected',()=>{
 for(const modify of [s=>{s.items[3].state='STORED'},s=>{s.items[0].text+=' agregado'},s=>{s.items[2].sha256=hash('otra foto')},s=>{s.items.push({itemId:'ti_'+'5'.repeat(40),kind:'TEXT',state:'STORED',sha256:hash('extra'),text:'extra'})}]){const s=scope();modify(s);assert.throws(()=>resolveApprovedLiteralOriginal(s,[approval]))}
});
test('a previous revision or another mode cannot acquire this selection',()=>{
 assert.throws(()=>resolveApprovedLiteralOriginal({...scope(),revision:19},[approval]));
 assert.equal(resolveApprovedLiteralOriginal({...scope(),baseRevision:13},[approval]),null);assert.equal(resolveApprovedLiteralOriginal({...scope(),mode:'EDITORIAL'},[approval]),null);
});
test('differences identify the exact selected original and changed fragment',()=>{
 const selection=resolveApprovedLiteralOriginal(scope(),[approval]);const d=literalComparisonDiagnostic({selection,expected:text,actual:text.replace('Primera','Tercera'),phase:'RENDERED_TEXT'});
 assert.equal(d.sourceItemId,source);assert.equal(d.sourceSha256,hash(text));assert.equal(d.equal,false);assert.ok(d.expectedFragment.includes('Primera'));assert.ok(d.actualFragment.includes('Tercera'));
});
