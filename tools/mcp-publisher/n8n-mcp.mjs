import {resolveDestinations} from './destinations.mjs';
// Adapter around an already authenticated, official MCP SDK client. Tool names
// must be selected from tools/list for the installed n8n instance. This module
// does not configure OAuth, own a token, or activate a workflow.
export function createN8nMcpBackend({client,workflowId,startTool,executionTool,triggerName='Entrada de prueba protegida'}) {
  if (!client || typeof client.callTool!=='function' || !workflowId || !startTool || !executionTool) throw new Error('Backend MCP no configurado');
  async function call(name,args) {
    const response=await client.callTool({name,arguments:args});
    if(response?.isError || !response?.structuredContent) throw new Error('Respuesta n8n MCP no confirmada');
    return response.structuredContent;
  }
  return {
    async start(payload) {
      if(payload?.PUBLICAR!==false || !resolveDestinations(payload?.CREAR_EN).length) throw new Error('Sólo se admiten borradores');
      const out=await call(startTool,{workflowId,executionMode:'production',triggerNodeName:triggerName,inputs:{webhookData:{method:'POST',body:payload}}});
      if(out.status!=='started' || typeof out.executionId!=='string' || !/^[A-Za-z0-9_-]{1,100}$/.test(out.executionId)) throw new Error('Ejecución no confirmada');
      return {executionId:out.executionId};
    },
    async read(executionId) {
      if(typeof executionId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(executionId)) throw new Error('Ejecución inválida');
      const out=await call(executionTool,{workflowId,executionId,includeData:true,nodeNames:['Resultado consolidado OPMX'],truncateData:1});
      if(out.execution?.id!==executionId || out.execution?.workflowId!==workflowId) throw new Error('Ejecución no coincide');
      const state=out.execution.status;
      if(state!=='success') return {state};
      const runs=out.data?.resultData?.runData?.['Resultado consolidado OPMX'];
      const result=runs?.[0]?.data?.main?.[0]?.[0]?.json;
      if(!result) throw new Error('Resultado no disponible');
      return {state,result};
    },
  };
}

