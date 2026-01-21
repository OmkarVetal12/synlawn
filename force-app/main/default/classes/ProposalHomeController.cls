public class ProposalHomeController {
    public String recordid {get;set;}
    public ProposalHomeController() {
        recordid = ApexPages.currentPage().getParameters().get('recordid');
    }
}