describe('filters.js', function () {
    beforeEach(function(){
        module('npn-viz-tool.filters');
    });

    describe('/ trim',function(){
        it('/ string',inject(function($filter){
            expect($filter('trim')(' Foo')).toBe('Foo');
        }));
        it('/ non-string',inject(function(trimFilter){
            expect(trimFilter(true)).toBe(true);
            expect(trimFilter(false)).toBe(false);
            expect(trimFilter(null)).toBe(null);
        }));
    });

    describe('/ ellipses',function(){
        it('/ basic',inject(function($filter){
            function randomString(length) {
                var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ',
                    i,text='';
                for(i = 0; i < length; i++) {
                    text += possible.charAt(Math.floor(Math.random() * possible.length));
                }
                return text;
            }
            var input = randomString(55),
                input2 = input + 'blah';
            expect($filter('ellipses')(input)).toBe(input);
            expect($filter('ellipses')(input2)).toBe(input+ ' ...');
        }));
        it('/ non-string',inject(function($filter){
            expect($filter('ellipses')(1)).toBe(1);
            expect($filter('ellipses')(false)).toBe(false);
            expect($filter('ellipses')(null)).toBe(null);
        }));
    });

    describe('/ doy',function(){
        it('/ basic',inject(function($filter){
            var doy = $filter('doy');
            [1,32,60,91,121,152,182,213,244,274,305,335].forEach(function(expected,index){
                var date = new Date(2010,index);
                expect(doy(date)).toBe(expected);
            });
            // a few misc mid-month tests
            expect(doy(new Date(2010,0,19))).toBe(19);
            expect(doy(new Date(2010,1,20))).toBe(51);
            expect(doy(new Date(2010,2,15))).toBe(74);
            expect(doy(new Date(2010,3,21))).toBe(111);
            expect(doy(new Date(2010,4,8))).toBe(128);
            expect(doy(new Date(2010,5,23))).toBe(174);
            expect(doy(new Date(2010,6,4))).toBe(185);
            expect(doy(new Date(2010,11,29))).toBe(363);
            // leap year
            expect(doy(new Date(2016,3,21))).toBe(112);
            expect(doy(new Date(2016,3,21),true)).toBe(111);
            // february 29
            expect(doy(new Date(2016,2,29))).toBe(89);
            expect(doy(new Date(2016,2,29),true)).toBe(88);
        }));
        it('/ string',inject(function($filter){
            var doy = $filter('doy');
            [1,32,60,91,121,152,182,213,244,274,305,335].forEach(function(expected,index){
                index++;
                var date = '2010-'+(index < 10 ? '0' :'')+index+'-01';
                expect(doy(date)).toBe(expected);
            });
            expect(doy('2010-12-29')).toBe(363);
            // leap year
            expect(doy('2016-04-21')).toBe(112);
            expect(doy('2016-04-21',true)).toBe(111);
        }));
        it('/ negative',inject(function($filter){
            var doy = $filter('doy');
            expect(doy('foo')).toBe('foo');
            expect(doy('2017-01-01-02')).toBe('2017-01-01-02');
            expect(doy(3000)).toBe(3000);
            expect(doy('2017-01-bar')).toBe('2017-01-bar');
            expect(doy('2017-01-32')).toBe('2017-01-32');
            expect(doy('2017-14-01')).toBe('2017-14-01');
        }));
    });
});
