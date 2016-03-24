describe('mapvis/services.js', function () {
    var ONE_DAY = (24*60*60*1000);
    function getDates(dateFilter) {
        var dates = [],
            today = new Date(),i;
        for(i = 6; i > 0; i--) {
            dates.push(dateFilter(new Date(today.getTime()-(i*ONE_DAY)),'yyyy-MM-ddT00:00:00.000Z'));
        }
        for(i = 0; i < 5; i++) {
            dates.push(dateFilter(new Date(today.getTime()+(i*ONE_DAY)),'yyyy-MM-ddT00:00:00.000Z'));
        }
        return dates;
    }

    beforeEach(function(){
        module('npn-viz-tool.gridded-services');
    });

    // the filter deals with more things like yesterday/tomorrow and exact dates
    // but for the purposes of the app before "today" and before a specific month/day
    // are the important use cases so limiting the testing to that for now.
    describe('/ extentDates',function(){
        it('/ before today',inject(function(dateFilter,extentDatesFilter){
            var dates = getDates(dateFilter),i,
                filtered = extentDatesFilter(dates,undefined,'today');
            expect(filtered.length).toBe(6);
            for(i = 0; i < filtered.length; i++) {
                expect(filtered[i]).toBe(dates[i]);
            }
        }));
        it('/ after today',inject(function(dateFilter,extentDatesFilter){
            var dates = getDates(dateFilter),i,
                filtered = extentDatesFilter(dates,'today');
            expect(filtered.length).toBe(4);
            for(i = 0; i < filtered.length; i++) {
                expect(filtered[i]).toBe(dates[i+7]);
            }
        }));
        it('/ before may 1',inject(function(dateFilter,extentDatesFilter){
            var thisYear = (new Date()).getFullYear(),
                dates = [
                    thisYear+'-04-28T00:00:00.000Z',
                    thisYear+'-04-29T00:00:00.000Z',
                    thisYear+'-04-30T00:00:00.000Z',
                    thisYear+'-05-01T00:00:00.000Z',
                    thisYear+'-05-02T00:00:00.000Z'
                ],i,
                filtered = extentDatesFilter(dates,undefined,'05-01');
            expect(filtered.length).toBe(3);
            for(i = 0; i < filtered.length; i++) {
                expect(filtered[i]).toBe(dates[i]);
            }
        }));
    });

});
