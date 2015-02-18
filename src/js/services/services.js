
angular.module('npn-viz-tool.services',[
'ngResource'
]);
/*
.factory('Docket', ['$resource',
    function($resource){
        var Docket = $resource(rdg_svcs.getScriptLocation()+'/regulations/v3/docket.json?docketId=:id', {}, {
            get: {
                method: 'GET',
                transformResponse: function(data, header) {
                    return rdg_svcs.transformResponse(data,header,Docket);
                }
            }
        });
        return Docket;
}])
.factory('Document', ['$resource',
    function($resource){
        var scriptLoc = rdg_svcs.getScriptLocation(),
            Document = $resource(scriptLoc+'/regulations/v3/document.json?documentId=:id', {}, {
            get: {
                method: 'GET',
                transformResponse: function(data, header) {
                    var wrapped = rdg_svcs.transformResponse(data,header,Document), a;
                    wrapped.$attachments = [];
                    angular.forEach(wrapped.attachments,function(attch){
                        if((a = getSingleAttachment(attch))) {
                            wrapped.$attachments.push(a);
                        }
                    });
                    return wrapped;
                }
            }
        });
        function getQueryArgs(url) {
            var q = url.indexOf('?'),
                qargs = q > 0 ? url.substring(q+1) : null;
            if(qargs) {
                qargs = qargs.split('&').reduce(function(args,arg){
                    var parts = arg.split('='), a = {};
                    args[parts[0]] = parts[1];
                    return args;
                },[]);
                return qargs;
            }
        }
        function getSingleAttachment(attachment) {
            var attachments = [],i;
            angular.forEach(attachment.fileFormats,function(fmt){
                var proxy = fmt.replace(/^http[s]*\:\/\/api\.data\.gov/,scriptLoc);
                attachments.push({
                    title: attachment.title,
                    url: proxy,
                    args: getQueryArgs(proxy)
                });
            });
            if(attachments.length > 1) {
                // look for a pdf attachment and prefer it.
                for(i = 0; i < attachments.length; i++) {
                    if(attachments[i].args && attachments[i].args.contentType === 'pdf') {
                        return attachments[i];
                    }
                }
            }
            return attachments.length ? attachments[0] : null;
        }
        return Document;
}])
.factory('Documents', ['$resource',
    function($resource){
        var Documents = $resource(rdg_svcs.getScriptLocation()+'/regulations/v3/documents.json', {}, {
            query: {method:'GET',
                transformResponse: function(data, header) {
                    return rdg_svcs.transformResponse(data,header,Documents,'documents',function(d){
                        d.$postedDate = new Date(d.postedDate);
                        return d;
                    });
                }
            }
        });
        return Documents;
}]);
*/