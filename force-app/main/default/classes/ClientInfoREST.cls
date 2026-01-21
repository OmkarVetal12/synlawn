@RestResource(urlMapping='/ClientInfo/*')
global with sharing class ClientInfoREST {
    @HttpGet
    global static String getClientInfo() {
        Map<String, String> headers = RestContext.request.headers;
        
        List<String> headerKeys = new List<String>{
            'True-Client-IP',
            'X-Forwarded-For',
            'X-Forwarded-Client-IP',
            'X-Real-IP',
            'Client-IP',
            'Forwarded',
            'X-Salesforce-SIP'
        };

        String clientIp;
        for (String key : headerKeys) {
            if (headers.containsKey(key)) {
                String value = headers.get(key);
                if (!String.isBlank(value)) {
                    clientIp = value.split(',')[0].trim();
                    if (!String.isBlank(clientIp)) break;
                }
            }
        }

        if (String.isBlank(clientIp)) {
            clientIp = 'unknown';
        }

        Map<String, Object> output = new Map<String, Object>{
            'ip' => clientIp,
            'headers' => headers
        };

        return JSON.serialize(output);
    }
}