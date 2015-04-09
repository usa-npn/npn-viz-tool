angular.module('npn-viz-tool.cluster',[
])
.factory('ClusterService',[function(){
    var service = {
        getDefaultClusterOptions: function() {
            var styles = [0,1,2,4,8,16,32,64,128,256].map(function(i){
                return {
                    n: (i*1000),
                    url: 'cluster/m'+i+'.png',
                    width: 52,
                    height: 52,
                    textColor: '#fff'
                };
            });
            return {
                styles: styles,
                maxZoom: 12
            };
        }
    };
    return service;
}]);