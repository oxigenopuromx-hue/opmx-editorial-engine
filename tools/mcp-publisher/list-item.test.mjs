import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const files=['OPMX_Publisher_MEDIA_v1.3.5_H105_LISTAS.json','OPMX_ENTRADA_AUTOMATICA_DESTINOS_v2.json'];
const list='<!-- wp:list --><ul class="wp-block-list"><!-- wp:list-item --><li>Uno<!-- wp:list --><ul><!-- wp:list-item --><li>Anidado</li><!-- /wp:list-item --></ul><!-- /wp:list --></li><!-- /wp:list-item --></ul><!-- /wp:list -->';
const master={CONTROL_EDITORIAL:{ESTADO:'LISTO'},SEO:{TITULO_SEO:'QA',SLUG:'qa-listas-h105',CATEGORIA:'TECNOLOGÍA',EXTRACTO:'QA',METADESCRIPCION:'QA',KEYWORD_PRINCIPAL:'prueba listas',ETIQUETAS:['QA']},CATEGORIAS:{OPURO:{PRINCIPAL:'TECNOLOGÍA'},OPOL:{PRINCIPAL:'TECNOLOGÍA',SECUNDARIA:null}},GUTENBERG_ENRIQUECIDO_FINAL:list,GUTENBERG_FINAL:list,IMAGENES:{HERO_OPURO:{URL:'{{OPMX:HERO_OPURO}}',ALT:'QA'},DESTACADA_OPURO:{URL:'{{OPMX:DESTACADA_OPURO}}',ALT:'QA'},DESTACADA_OPOL:{URL:'{{OPMX:DESTACADA_OPOL}}',ALT:'QA'}}};
for(const file of files){
 const w=JSON.parse(readFileSync('workflows/publisher/'+file));
 const run=new AsyncFunction('$json','$input',w.nodes.find(n=>n.name==='Validar y normalizar OPMX MASTER').parameters.jsCode);
 const input={item:{binary:{hero_file:{mimeType:'image/png'},featured_file:{mimeType:'image/png'}}}};
 const envelope=m=>({json:JSON.stringify(m),CREAR_EN:'AMBOS',PUBLICAR:false});
 test(file+': preserves native nested list-item content',async()=>{
  assert.equal((await run(envelope(master),input)).json.canonical.gutenberg_enriquecido_final,list);
  const namespaced=list.replaceAll('wp:list-item','wp:core/list-item');
  assert.equal((await run(envelope({...master,GUTENBERG_ENRIQUECIDO_FINAL:namespaced}),input)).json.canonical.gutenberg_enriquecido_final,namespaced);
 });
 test(file+': still rejects HTML and custom blocks',async()=>{
  for(const bad of ['<!-- wp:html --><b>QA</b><!-- /wp:html -->','<!-- wp:custom/list-item --><p>QA</p><!-- /wp:custom/list-item -->'])await assert.rejects(run(envelope({...master,GUTENBERG_ENRIQUECIDO_FINAL:bad}),input));
 });
}

